import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { Mic, MicOff, Keyboard, History, Film, Bookmark, PhoneOff, Send, X, Loader2, Home, Volume2, VolumeX, Share2, Check, Download } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useCharacter } from "@/lib/use-characters";
import { chatWithCharacter, synthesizeSpeech, transcribeAudio } from "@/lib/character-generation.functions";
import type { Reaction } from "@/lib/characters";

import { useAuth } from "@/lib/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { LangToggle, useT } from "@/lib/i18n";

const INACTIVITY_MS = 60_000;

export const Route = createFileRoute("/chat/$id")({
  component: Chat,
});

type Message = { role: "user" | "assistant"; content: string; saved?: boolean; reactionIdx?: number };

const RECORDING_SAMPLE_RATE = 24_000;
const SILENCE_RMS_THRESHOLD = 0.012;
const SILENCE_TIMEOUT_MS = 3_000;

function detectLang(text: string): "fr" | "en" | null {
  const t = text.toLowerCase();
  if (/[àâçéèêëîïôûùüÿñœæ]/.test(t)) return "fr";
  const frRe = /\b(le|la|les|un|une|des|je|tu|nous|vous|est|c'est|pour|avec|mais|pas|oui|non|bonjour|salut|merci|qui|que|quoi|comment|pourquoi|où|dans|sur|sous|très|bien|aussi|alors|donc|ça|cette|ce|mon|ma|mes|ton|ta|tes|son|sa|ses|nos|vos|leur|leurs|moi|toi|lui|elle|ils|elles)\b/g;
  const enRe = /\b(the|a|an|i|you|we|they|is|are|was|were|for|with|but|not|yes|no|hello|hi|hey|thanks|thank|who|what|how|why|where|when|in|on|under|about|do|does|did|have|has|can|could|would|should|my|your|his|her|our|their|me|him|us|them)\b/g;
  const fr = (t.match(frRe) || []).length;
  const en = (t.match(enRe) || []).length;
  if (fr > en) return "fr";
  if (en > fr) return "en";
  return null;
}

function encodeWav(samples: Float32Array, sampleRate: number) {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const writeString = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i));
  };

  writeString(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, "data");
  view.setUint32(40, samples.length * 2, true);

  let offset = 44;
  for (const sample of samples) {
    const clamped = Math.max(-1, Math.min(1, sample));
    view.setInt16(offset, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true);
    offset += 2;
  }
  return new Blob([buffer], { type: "audio/wav" });
}

function Chat() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { character, isLoading } = useCharacter(id);
  const { t, lang } = useT();

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [mode, setMode] = useState<"voice" | "text">("voice");
  const [showHistory, setShowHistory] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [reactingTick, setReactingTick] = useState(0);
  const [specialTick, setSpecialTick] = useState(0);
  const [currentReactionIdx, setCurrentReactionIdx] = useState<number>(0);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  const [muted, setMuted] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem("voice_muted") === "1";
  });
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [shareCopied, setShareCopied] = useState(false);
  const [sharing, setSharing] = useState(false);
  const lastAudioB64Ref = useRef<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { user, loading: authLoading } = useAuth();
  const conversationIdRef = useRef<string | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);

  // Inactivity → retour à l'accueil après 60s
  const lastActivityRef = useRef(Date.now());
  const bump = useCallback(() => { lastActivityRef.current = Date.now(); }, []);
  useEffect(() => {
    const iv = setInterval(() => {
      if (Date.now() - lastActivityRef.current > INACTIVITY_MS) {
        navigate({ to: "/" });
      }
    }, 5000);
    const evts: (keyof WindowEventMap)[] = ["pointerdown", "keydown", "touchstart"];
    evts.forEach((e) => window.addEventListener(e, bump));
    return () => {
      clearInterval(iv);
      evts.forEach((e) => window.removeEventListener(e, bump));
    };
  }, [bump, navigate]);

  const reactions: Reaction[] = useMemo(() => character?.reactions ?? [], [character]);
  const currentReaction = reactions[currentReactionIdx];
  const displayAvatar = currentReaction?.imageUrl ?? character?.avatar ?? "";

  // Easter-egg "special" every 25s while idle
  useEffect(() => {
    const t = setInterval(() => {
      if (!isSpeaking && !isThinking) setSpecialTick((n) => n + 1);
    }, 25000);
    return () => clearInterval(t);
  }, [isSpeaking, isThinking]);


  // Greeting effect — defined further down once playReply is available
  const greetedRef = useRef(false);

  useEffect(() => {
    if (mode === "text") inputRef.current?.focus();
  }, [mode]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const chat = useServerFn(chatWithCharacter);
  const speak = useServerFn(synthesizeSpeech);
  const transcribe = useServerFn(transcribeAudio);
  const isCustom = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const recordedSamplesRef = useRef<Float32Array[]>([]);
  const lastVoiceAtRef = useRef<number>(0);
  const silenceTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Redirect to /auth when not authenticated so conversations can be saved
  useEffect(() => {
    if (!authLoading && !user) {
      navigate({ to: "/auth" });
    }
  }, [authLoading, user, navigate]);

  const playReply = async (text: string) => {
    if (!text.trim() || muted) return;
    try {
      const { audio, mime } = await speak({ data: { characterId: id, text } });
      const url = `data:${mime};base64,${audio}`;
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = url;
        await audioRef.current.play().catch(() => {});
      }
    } catch (err) {
      console.error("TTS error:", err);
    }
  };

  // Greeting: insert intro + play audio once character is loaded
  useEffect(() => {
    if (!character || greetedRef.current) return;
    greetedRef.current = true;
    setMessages([{ role: "assistant", content: character.greeting, reactionIdx: 0 }]);
    setIsSpeaking(true);
    void playReply(character.greeting);
    const tm = setTimeout(() => setIsSpeaking(false), 2400);
    return () => clearTimeout(tm);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [character?.id]);
  const toggleMute = () => {
    setMuted((prev) => {
      const next = !prev;
      if (typeof window !== "undefined") {
        window.localStorage.setItem("voice_muted", next ? "1" : "0");
      }
      if (next && audioRef.current) {
        audioRef.current.pause();
      }
      return next;
    });
  };

  const handleShare = async () => {
    if (!user) {
      navigate({ to: "/auth" });
      return;
    }
    setSharing(true);
    try {
      let cid = conversationIdRef.current;
      if (!cid) {
        const { data, error } = await supabase
          .from("conversations")
          .insert({ user_id: user.id, character_id: id, title: character?.name ?? "" })
          .select("id, share_token")
          .single();
        if (error || !data) throw error ?? new Error("création conversation échouée");
        conversationIdRef.current = data.id;
        setConversationId(data.id);
      }
      cid = conversationIdRef.current!;
      const { data: updated, error: updErr } = await supabase
        .from("conversations")
        .update({ is_public: true })
        .eq("id", cid)
        .select("share_token")
        .single();
      if (updErr || !updated) throw updErr ?? new Error("activation partage échouée");
      const url = `${window.location.origin}/shared/${updated.share_token}`;
      setShareUrl(url);
      try {
        await navigator.clipboard.writeText(url);
        setShareCopied(true);
        setTimeout(() => setShareCopied(false), 2000);
      } catch { /* clipboard refused */ }
    } catch (err) {
      console.error("share error:", err);
      setMicError(err instanceof Error ? err.message : "Partage impossible");
    } finally {
      setSharing(false);
    }
  };

  const persistMessages = async (newOnes: Message[]) => {
    if (!user || newOnes.length === 0) return;
    try {
      if (!conversationIdRef.current) {
        const { data, error } = await supabase
          .from("conversations")
          .insert({ user_id: user.id, character_id: id, title: character?.name ?? "" })
          .select("id")
          .single();
        if (error || !data) return;
        conversationIdRef.current = data.id;
        setConversationId(data.id);
      }
      const cid = conversationIdRef.current;
      await supabase.from("messages").insert(
        newOnes.map((m) => ({
          conversation_id: cid,
          user_id: user.id,
          role: m.role,
          content: m.content,
        })),
      );
    } catch (err) {
      console.error("save conversation:", err);
    }
  };

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    bump();
    const userMsg: Message = { role: "user", content: trimmed };
    const nextMessages: Message[] = [...messages, userMsg];
    setMessages(nextMessages);
    setInput("");
    setIsThinking(true);

    try {
      if (isCustom || ["napoleon", "einstein", "mjackson"].includes(id)) {
        const history = nextMessages.map((m) => ({ role: m.role, content: m.content }));
        const { reply, reactionIdx, audio, mime } = await chat({
          data: { characterId: id, messages: history, withAudio: !muted, lang: detectLang(trimmed) ?? lang },
        });
        setIsThinking(false);
        const safeReactionIdx = reactions.length > 0 ? reactionIdx : 0;
        setCurrentReactionIdx(safeReactionIdx);
        if (/[!?]/.test(reply)) setReactingTick((n) => n + 1);
        const aMsg: Message = { role: "assistant", content: reply, reactionIdx: safeReactionIdx };
        setMessages((m) => [...m, aMsg]);
        void persistMessages([userMsg, aMsg]);
        if (audio && mime && !muted && audioRef.current) {
          audioRef.current.pause();
          audioRef.current.src = `data:${mime};base64,${audio}`;
          void audioRef.current.play().catch(() => {});
        } else {
          void playReply(reply);
        }
      } else {
        const nextIdx = reactions.length > 0 ? Math.floor(Math.random() * reactions.length) : 0;
        setCurrentReactionIdx(nextIdx);
        const reactionLabel = reactions[nextIdx]?.label ?? "";
        setIsThinking(false);
        const aMsg: Message = {
          role: "assistant",
          content: `(${character?.name ?? ""}${reactionLabel ? ` — ${reactionLabel}` : ""}) Connectez l'API LLM pour activer la réponse complète.`,
          reactionIdx: nextIdx,
        };
        setMessages((m) => [...m, aMsg]);
        void persistMessages([userMsg, aMsg]);
      }
    } catch (err) {
      setIsThinking(false);
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          content: `Désolé, une erreur est survenue : ${err instanceof Error ? err.message : "inconnue"}`,
        },
      ]);
    }
  };

  const stopPcmRecording = useCallback(async () => {
    if (silenceTimerRef.current) {
      clearInterval(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    const stream = mediaStreamRef.current;
    const context = audioContextRef.current;
    const sampleRate = context?.sampleRate ?? RECORDING_SAMPLE_RATE;
    processorRef.current?.disconnect();
    sourceRef.current?.disconnect();
    stream?.getTracks().forEach((t) => t.stop());
    mediaStreamRef.current = null;
    processorRef.current = null;
    sourceRef.current = null;
    audioContextRef.current = null;
    setIsRecording(false);

    if (context && context.state !== "closed") await context.close();

    const chunks = recordedSamplesRef.current;
    recordedSamplesRef.current = [];
    const sampleCount = chunks.reduce((total, chunk) => total + chunk.length, 0);
    if (sampleCount < RECORDING_SAMPLE_RATE / 4) return;

    const samples = new Float32Array(sampleCount);
    let offset = 0;
    for (const chunk of chunks) {
      samples.set(chunk, offset);
      offset += chunk.length;
    }

    const blob = encodeWav(samples, sampleRate);
    const buf = await blob.arrayBuffer();
    const bytes = new Uint8Array(buf);
    let bin = "";
    const CH = 0x8000;
    for (let i = 0; i < bytes.length; i += CH) {
      bin += String.fromCharCode(...bytes.subarray(i, i + CH));
    }
    const b64 = btoa(bin);
    lastAudioB64Ref.current = b64;
    setMicError(null);
    setIsTranscribing(true);
    try {
      const { text } = await transcribe({
        data: { audioBase64: b64, mime: "audio/wav" },
      });
      setIsTranscribing(false);
      lastAudioB64Ref.current = null;
      if (text) await send(text);
    } catch (err) {
      setIsTranscribing(false);
      const raw = err instanceof Error ? err.message : "Transcription échouée";
      const isFormat = /unsupported content type|Format audio non supporté|SLNG STT \d+|Gradium STT \d+/i.test(raw);
      setMicError(
        isFormat
          ? "Le service de transcription n'a pas pu lire l'audio. Réessayez l'envoi ou recommencez l'enregistrement."
          : `Transcription échouée : ${raw}`,
      );
    }
  }, [send, transcribe]);

  const retryTranscription = useCallback(async () => {
    const b64 = lastAudioB64Ref.current;
    if (!b64) return;
    setMicError(null);
    setIsTranscribing(true);
    try {
      const { text } = await transcribe({ data: { audioBase64: b64, mime: "audio/wav" } });
      setIsTranscribing(false);
      lastAudioB64Ref.current = null;
      if (text) await send(text);
    } catch (err) {
      setIsTranscribing(false);
      const raw = err instanceof Error ? err.message : "Transcription échouée";
      setMicError(`Nouvelle tentative échouée : ${raw}`);
    }
  }, [send, transcribe]);

  const stopRecording = useCallback(() => {
    void stopPcmRecording();
  }, [stopPcmRecording]);

  const startRecording = useCallback(async () => {
    setMicError(null);
    // Pressing Speak interrupts the assistant
    if (audioRef.current) {
      audioRef.current.pause();
      try { audioRef.current.currentTime = 0; } catch { /* ignore */ }
    }
    setIsSpeaking(false);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      recordedSamplesRef.current = [];
      lastVoiceAtRef.current = Date.now();

      const AudioContextClass = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextClass) throw new Error("Enregistrement audio non supporté par ce navigateur");
      const context = new AudioContextClass({ sampleRate: RECORDING_SAMPLE_RATE });
      const source = context.createMediaStreamSource(stream);
      const processor = context.createScriptProcessor(4096, 1, 1);
      processor.onaudioprocess = (event) => {
        const data = event.inputBuffer.getChannelData(0);
        recordedSamplesRef.current.push(new Float32Array(data));
        // Compute RMS to detect voice activity
        let sum = 0;
        for (let i = 0; i < data.length; i++) sum += data[i] * data[i];
        const rms = Math.sqrt(sum / data.length);
        if (rms > SILENCE_RMS_THRESHOLD) lastVoiceAtRef.current = Date.now();
      };
      source.connect(processor);
      processor.connect(context.destination);
      audioContextRef.current = context;
      sourceRef.current = source;
      processorRef.current = processor;
      setIsRecording(true);

      // Auto-stop after 3s of silence (only counts after first voice or grace period)
      const startedAt = Date.now();
      silenceTimerRef.current = setInterval(() => {
        const now = Date.now();
        // Grace: don't stop in the first second
        if (now - startedAt < 1000) return;
        if (now - lastVoiceAtRef.current > SILENCE_TIMEOUT_MS) {
          void stopPcmRecording();
        }
      }, 250);
    } catch (err) {
      setMicError(err instanceof Error ? err.message : "Accès micro refusé");
      setIsRecording(false);
    }
  }, [stopPcmRecording]);

  useEffect(() => {
    return () => {
      processorRef.current?.disconnect();
      sourceRef.current?.disconnect();
      void audioContextRef.current?.close();
      mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  if (isLoading || authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gold" />
      </div>
    );
  }

  if (!character) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Link to="/select" className="text-gold underline">Retour</Link>
      </div>
    );
  }

  const toggleMic = () => {
    if (isRecording) stopRecording();
    else void startRecording();
  };

  const last = messages[messages.length - 1];

  const handleExportTxt = () => {
    const charName = character?.name ?? "personnage";
    const date = new Date();
    const header = `Conversation avec ${charName}\n${date.toLocaleString()}\n${"=".repeat(40)}\n\n`;
    const body = messages
      .map((m) => `${m.role === "user" ? t("you") : charName}:\n${m.content}\n`)
      .join("\n");
    const blob = new Blob([header + body], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const safe = charName.toLowerCase().replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "");
    a.href = url;
    a.download = `conversation-${safe}-${date.toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="vignette relative flex min-h-screen flex-col overflow-hidden bg-background">
      <audio ref={audioRef} hidden onPlay={() => setIsSpeaking(true)} onEnded={() => setIsSpeaking(false)} onPause={() => setIsSpeaking(false)} />
      {/* Avatar background (reaction-aware) */}
      <div
        className="absolute inset-0 transition-all duration-700"
        style={{
          backgroundImage: `url(${displayAvatar})`,
          backgroundSize: "cover",
          backgroundPosition: "center top",
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-background/40 via-background/60 to-background" />

      {/* Portrait de réaction centré */}
      {currentReaction && (
        <div className="pointer-events-none absolute left-1/2 top-24 z-10 -translate-x-1/2">
          <img
            key={currentReactionIdx}
            src={currentReaction.imageUrl}
            alt={currentReaction.label}
            className="h-48 w-48 rounded-full object-cover shadow-cinema ring-2 ring-gold/40"
          />
          <p className="mt-3 text-center text-xs uppercase tracking-[0.3em] text-gold/80">
            {currentReaction.emoji} {currentReaction.label}
          </p>
        </div>
      )}

      {/* Header */}
      <header className="relative z-10 flex items-center justify-between gap-2 px-5 pt-6">
        <div className="flex items-center gap-2">
          <button
            onClick={toggleMute}
            aria-label={muted ? t("voice_off") : t("voice_on")}
            title={muted ? t("voice_off") : t("voice_on")}
            className={`flex h-10 w-10 items-center justify-center rounded-full border backdrop-blur transition-colors ${muted ? "border-destructive/50 bg-destructive/15 text-destructive" : "border-gold/40 bg-card/60 text-gold hover:bg-accent"}`}
          >
            {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </button>
          <div className="relative">
            <img src={character.avatar} width={44} height={44} alt="" className="h-11 w-11 rounded-full object-cover ring-1 ring-gold/40" />
            {isSpeaking && !muted && (
              <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-call ring-2 ring-background" />
            )}
          </div>
          <div>
            <p className="font-display text-lg leading-tight">{character.name}</p>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
              {muted ? t("voice_muted") : isSpeaking ? t("speaking") : t("online")}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <LangToggle />
          <button
            onClick={handleShare}
            disabled={sharing}
            className="flex items-center gap-1.5 rounded-full border border-gold/40 bg-card/60 px-3 py-1.5 text-xs text-gold backdrop-blur hover:bg-accent disabled:opacity-50"
            aria-label={t("share")}
          >
            {sharing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : shareCopied ? <Check className="h-3.5 w-3.5" /> : <Share2 className="h-3.5 w-3.5" />}
            {shareCopied ? t("copied") : t("share")}
          </button>
          <Link
            to="/"
            className="flex items-center gap-1.5 rounded-full border border-border bg-card/60 px-3 py-1.5 text-xs backdrop-blur hover:bg-accent"
            aria-label={t("home")}
          >
            <Home className="h-3.5 w-3.5" /> {t("home")}
          </Link>
          <button
            onClick={() => setShowHistory(true)}
            className="rounded-full border border-border bg-card/60 px-3 py-1.5 text-xs backdrop-blur"
          >
            {t("history")}
          </button>
        </div>
      </header>

      {/* Share link toast */}
      {shareUrl && (
        <div className="absolute left-1/2 top-20 z-30 -translate-x-1/2 max-w-md rounded-xl border border-gold/40 bg-card/95 px-4 py-3 text-xs shadow-cinema backdrop-blur">
          <p className="mb-1 font-medium text-gold">{t("share_link")} {shareCopied && `(${t("copied")})`}</p>
          <div className="flex items-center gap-2">
            <input
              readOnly
              value={shareUrl}
              onFocus={(e) => e.currentTarget.select()}
              className="flex-1 rounded-md border border-border bg-background px-2 py-1 text-[11px]"
            />
            <button
              onClick={() => { void navigator.clipboard.writeText(shareUrl).then(() => { setShareCopied(true); setTimeout(() => setShareCopied(false), 1500); }); }}
              className="rounded-md border border-gold/40 px-2 py-1 text-[11px] text-gold hover:bg-accent"
            >
              {t("share_copy")}
            </button>
            <button
              onClick={() => setShareUrl(null)}
              className="rounded-md border border-border px-2 py-1 text-[11px] text-muted-foreground hover:bg-accent"
              aria-label={t("close")}
            >
              <X className="h-3 w-3" />
            </button>
          </div>
          <p className="mt-2 text-[10px] text-muted-foreground">
            {t("share_hint")}
          </p>
        </div>
      )}

      {/* Live subtitle of assistant */}
      <main className="relative z-10 flex flex-1 flex-col items-center justify-end px-6 pb-44">
        {last?.role === "assistant" && (
          <div key={messages.length} className="animate-fade-up max-w-xl text-center">
            <p className="font-display text-2xl leading-snug text-foreground drop-shadow-lg md:text-3xl">
              « {last.content} »
            </p>
            <p className="mt-3 text-xs uppercase tracking-[0.3em] text-gold/80">— {character.name}</p>
          </div>
        )}
        {last?.role === "user" && (
          <div className="animate-fade-up text-center">
            <p className="text-sm uppercase tracking-[0.3em] text-muted-foreground">{t("you_said")}</p>
            <p className="mt-2 max-w-xl text-lg italic text-foreground/90">« {last.content} »</p>
          </div>
        )}
      </main>

      {/* Text input overlay */}
      {mode === "text" && (
        <div className="absolute inset-x-0 bottom-32 z-20 mx-auto max-w-2xl px-5">
          <form
            onSubmit={(e) => { e.preventDefault(); send(input); }}
            className="flex items-end gap-2 rounded-2xl border border-border bg-card/90 p-2 shadow-cinema backdrop-blur"
          >
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); }
              }}
              rows={1}
              placeholder={`${t("write_to")} ${character.name.split(" ")[0]}…`}
              className="max-h-32 flex-1 resize-none bg-transparent px-3 py-2 text-sm outline-none placeholder:text-muted-foreground"
            />
            <button type="submit" className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground transition-transform active:scale-95">
              <Send className="h-4 w-4" />
            </button>
          </form>
        </div>
      )}

      {micError && (
        <div className="absolute inset-x-0 bottom-36 z-20 mx-auto max-w-md px-6">
          <div className="flex flex-col items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-center text-xs text-destructive">
            <span>{micError}</span>
            <div className="flex gap-2">
              {lastAudioB64Ref.current && (
                <button
                  type="button"
                  onClick={retryTranscription}
                  disabled={isTranscribing}
                  className="rounded-md border border-destructive/40 bg-destructive/10 px-2 py-1 text-[11px] font-medium text-destructive hover:bg-destructive/20 disabled:opacity-50"
                >
                  {isTranscribing ? t("retry_loading") : t("retry")}
                </button>
              )}
              <button
                type="button"
                onClick={() => setMicError(null)}
                className="rounded-md border border-destructive/30 px-2 py-1 text-[11px] font-medium text-destructive/80 hover:bg-destructive/10"
              >
                {t("close")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Action bar */}
      <div className="absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-background via-background/95 to-transparent pb-8 pt-12">
        <div className="mx-auto flex max-w-md items-center justify-around px-6">
          <ActionButton
            icon={mode === "voice" ? <Mic /> : <Keyboard />}
            label={mode === "voice" ? t("voice_mode") : t("text_mode")}
            onClick={() => setMode(mode === "voice" ? "text" : "voice")}
            active
          />
          {mode === "voice" ? (
            <ActionButton
              icon={isRecording ? <MicOff /> : isTranscribing ? <Loader2 className="animate-spin" /> : <Mic />}
              label={isRecording ? t("stop") : isTranscribing ? t("transcribing") : t("speak")}
              onClick={toggleMic}
              active={isRecording}
            />
          ) : (
            <ActionButton icon={<Film />} label={t("scene")} onClick={() => send(t("scene_prompt"))} />
          )}

          <button
            onClick={() => navigate({ to: "/select" })}
            className="flex h-16 w-16 items-center justify-center rounded-full bg-hangup shadow-cinema transition-transform active:scale-95"
            aria-label={t("hangup")}
          >
            <PhoneOff className="h-6 w-6 text-white" />
          </button>

          <ActionButton
            icon={<Bookmark />}
            label={t("save")}
            onClick={() => {
              setMessages((m) => m.map((msg, i) => i === m.length - 1 ? { ...msg, saved: true } : msg));
            }}
          />
          <ActionButton icon={<History />} label={t("thread")} onClick={() => setShowHistory(true)} />
        </div>
      </div>

      {/* History drawer */}
      {showHistory && (
        <div className="absolute inset-0 z-30 flex">
          <div className="flex-1 bg-black/60" onClick={() => setShowHistory(false)} />
          <aside className="flex w-full max-w-md flex-col border-l border-border bg-card shadow-cinema">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <div>
                <p className="font-display text-xl">{t("conversation")}</p>
                <p className="text-xs text-muted-foreground">{t("with")} {character.name}</p>
              </div>
              <button onClick={() => setShowHistory(false)} className="rounded-full p-2 hover:bg-accent">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="border-b border-border px-5 py-3">
              <button
                onClick={handleExportTxt}
                disabled={messages.length === 0}
                className="flex items-center gap-2 rounded-full border border-gold/40 bg-card/60 px-3 py-1.5 text-xs text-gold hover:bg-accent disabled:opacity-50"
              >
                <Download className="h-3.5 w-3.5" />
                {t("export_txt")}
              </button>
            </div>
            <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
              {messages.map((m, i) => (
                <div key={i} className={m.role === "user" ? "ml-auto max-w-[80%]" : "mr-auto max-w-[85%]"}>
                  <p className="mb-1 text-[10px] uppercase tracking-widest text-muted-foreground">
                    {m.role === "user" ? t("you") : character.name} {m.saved && "· 📌"}
                  </p>
                  <div
                    className={
                      m.role === "user"
                        ? "rounded-2xl rounded-tr-sm bg-primary px-4 py-2 text-sm text-primary-foreground"
                        : "rounded-2xl rounded-tl-sm bg-accent px-4 py-2 text-sm text-accent-foreground"
                    }
                  >
                    {m.content}
                  </div>
                </div>
              ))}
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}

function ActionButton({ icon, label, onClick, active }: { icon: React.ReactNode; label: string; onClick: () => void; active?: boolean }) {
  return (
    <button onClick={onClick} className="flex flex-col items-center gap-1.5">
      <span className={`flex h-12 w-12 items-center justify-center rounded-full border backdrop-blur transition-colors ${active ? "border-gold/60 bg-gold/15 text-gold" : "border-border bg-card/60 text-foreground hover:bg-accent"}`}>
        <span className="[&>svg]:h-5 [&>svg]:w-5">{icon}</span>
      </span>
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
    </button>
  );
}
