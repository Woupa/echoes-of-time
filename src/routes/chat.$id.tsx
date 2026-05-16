import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { Mic, MicOff, Keyboard, History, Film, Bookmark, PhoneOff, Send, X, Loader2, Home } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useCharacter } from "@/lib/use-characters";
import { chatWithCharacter, synthesizeSpeech, transcribeAudio } from "@/lib/character-generation.functions";
import type { Reaction } from "@/lib/characters";

import { useAuth } from "@/lib/use-auth";
import { supabase } from "@/integrations/supabase/client";

const INACTIVITY_MS = 60_000;

export const Route = createFileRoute("/chat/$id")({
  component: Chat,
});

type Message = { role: "user" | "assistant"; content: string; saved?: boolean; reactionIdx?: number };

function Chat() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { character, isLoading } = useCharacter(id);

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
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();
  const conversationIdRef = useRef<string | null>(null);

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


  useEffect(() => {
    if (character && messages.length === 0) {
      setMessages([{ role: "assistant", content: character.greeting, reactionIdx: 0 }]);
      setIsSpeaking(true);
      const t = setTimeout(() => setIsSpeaking(false), 2400);
      return () => clearTimeout(t);
    }
  }, [character, messages.length]);

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
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);

  if (isLoading) {
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

  const playReply = async (text: string) => {
    if (!isCustom || !text.trim()) return;
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
      if (isCustom && reactions.length > 0) {
        const history = nextMessages.map((m) => ({ role: m.role, content: m.content }));
        const { reply, reactionIdx } = await chat({
          data: { characterId: id, messages: history },
        });
        setIsThinking(false);
        setCurrentReactionIdx(reactionIdx);
        if (/[!?]/.test(reply)) setReactingTick((n) => n + 1);
        const aMsg: Message = { role: "assistant", content: reply, reactionIdx };
        setMessages((m) => [...m, aMsg]);
        void persistMessages([userMsg, aMsg]);
        void playReply(reply);
      } else {
        const nextIdx = reactions.length > 0 ? Math.floor(Math.random() * reactions.length) : 0;
        setCurrentReactionIdx(nextIdx);
        const reactionLabel = reactions[nextIdx]?.label ?? "";
        setIsThinking(false);
        const aMsg: Message = {
          role: "assistant",
          content: `(${character.name}${reactionLabel ? ` — ${reactionLabel}` : ""}) Connectez l'API LLM pour activer la réponse complète.`,
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

  const stopRecording = useCallback(() => {
    const mr = mediaRecorderRef.current;
    if (mr && mr.state !== "inactive") mr.stop();
  }, []);

  const startRecording = useCallback(async () => {
    setMicError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      recordedChunksRef.current = [];

      // Gradium STT rejects codec parameters (e.g. "audio/webm;codecs=opus").
      // Prefer container-only MIME types it accepts.
      const mimeCandidates = [
        "audio/mp4",
        "audio/webm",
        "audio/ogg",
      ];
      const supported = mimeCandidates.find((m) =>
        typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported?.(m),
      );
      const mr = new MediaRecorder(stream, supported ? { mimeType: supported } : undefined);
      mediaRecorderRef.current = mr;

      mr.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) recordedChunksRef.current.push(e.data);
      };
      mr.onstop = async () => {
        const tracks = mediaStreamRef.current?.getTracks() ?? [];
        tracks.forEach((t) => t.stop());
        mediaStreamRef.current = null;
        setIsRecording(false);

        const chunks = recordedChunksRef.current;
        if (chunks.length === 0) return;
        const rawType = mr.mimeType || "audio/webm";
        // Strip codec parameter — Gradium rejects "audio/webm;codecs=opus".
        const cleanType = rawType.split(";")[0].trim() || "audio/webm";
        const blob = new Blob(chunks, { type: cleanType });
        if (blob.size < 800) return; // too short

        setIsTranscribing(true);
        try {
          const buf = await blob.arrayBuffer();
          const bytes = new Uint8Array(buf);
          let bin = "";
          const CH = 0x8000;
          for (let i = 0; i < bytes.length; i += CH) {
            bin += String.fromCharCode(...bytes.subarray(i, i + CH));
          }
          const b64 = btoa(bin);
          const { text } = await transcribe({
            data: { audioBase64: b64, mime: blob.type || "audio/webm" },
          });
          setIsTranscribing(false);
          if (text) await send(text);
        } catch (err) {
          setIsTranscribing(false);
          setMicError(err instanceof Error ? err.message : "Transcription échouée");
        }
      };

      mr.start();
      setIsRecording(true);
    } catch (err) {
      setMicError(err instanceof Error ? err.message : "Accès micro refusé");
      setIsRecording(false);
    }
  }, [transcribe]);

  useEffect(() => {
    return () => {
      const mr = mediaRecorderRef.current;
      if (mr && mr.state !== "inactive") mr.stop();
      mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const toggleMic = () => {
    if (isRecording) stopRecording();
    else void startRecording();
  };

  const last = messages[messages.length - 1];

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
      <header className="relative z-10 flex items-center justify-between px-5 pt-6">
        <div className="flex items-center gap-3">
          <div className="relative">
            <img src={character.avatar} width={44} height={44} alt="" className="h-11 w-11 rounded-full object-cover ring-1 ring-gold/40" />
            {isSpeaking && (
              <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-call ring-2 ring-background" />
            )}
          </div>
          <div>
            <p className="font-display text-lg leading-tight">{character.name}</p>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
              {isSpeaking ? "Parle…" : "En ligne · Pionnier"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/"
            className="flex items-center gap-1.5 rounded-full border border-border bg-card/60 px-3 py-1.5 text-xs backdrop-blur hover:bg-accent"
            aria-label="Retour à l'accueil"
          >
            <Home className="h-3.5 w-3.5" /> Accueil
          </Link>
          <button
            onClick={() => setShowHistory(true)}
            className="rounded-full border border-border bg-card/60 px-3 py-1.5 text-xs backdrop-blur"
          >
            Historique
          </button>
        </div>
      </header>

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
            <p className="text-sm uppercase tracking-[0.3em] text-muted-foreground">Vous avez dit</p>
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
              placeholder={`Écrivez à ${character.name.split(" ")[0]}…`}
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
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-center text-xs text-destructive">
            {micError}
          </div>
        </div>
      )}

      {/* Action bar */}
      <div className="absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-background via-background/95 to-transparent pb-8 pt-12">
        <div className="mx-auto flex max-w-md items-center justify-around px-6">
          <ActionButton
            icon={mode === "voice" ? <Mic /> : <Keyboard />}
            label={mode === "voice" ? "Vocal" : "Clavier"}
            onClick={() => setMode(mode === "voice" ? "text" : "voice")}
            active
          />
          {mode === "voice" ? (
            <ActionButton
              icon={isRecording ? <MicOff /> : isTranscribing ? <Loader2 className="animate-spin" /> : <Mic />}
              label={isRecording ? "Stop" : isTranscribing ? "Transcrit…" : "Parler"}
              onClick={toggleMic}
              active={isRecording}
            />
          ) : (
            <ActionButton icon={<Film />} label="Scène" onClick={() => send("Imagine une scène : que feriez-vous aujourd'hui ?")} />
          )}

          <button
            onClick={() => navigate({ to: "/select" })}
            className="flex h-16 w-16 items-center justify-center rounded-full bg-hangup shadow-cinema transition-transform active:scale-95"
            aria-label="Raccrocher"
          >
            <PhoneOff className="h-6 w-6 text-white" />
          </button>

          <ActionButton
            icon={<Bookmark />}
            label="Mémoriser"
            onClick={() => {
              setMessages((m) => m.map((msg, i) => i === m.length - 1 ? { ...msg, saved: true } : msg));
            }}
          />
          <ActionButton icon={<History />} label="Fil" onClick={() => setShowHistory(true)} />
        </div>
      </div>

      {/* History drawer */}
      {showHistory && (
        <div className="absolute inset-0 z-30 flex">
          <div className="flex-1 bg-black/60" onClick={() => setShowHistory(false)} />
          <aside className="flex w-full max-w-md flex-col border-l border-border bg-card shadow-cinema">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <div>
                <p className="font-display text-xl">Conversation</p>
                <p className="text-xs text-muted-foreground">avec {character.name}</p>
              </div>
              <button onClick={() => setShowHistory(false)} className="rounded-full p-2 hover:bg-accent">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
              {messages.map((m, i) => (
                <div key={i} className={m.role === "user" ? "ml-auto max-w-[80%]" : "mr-auto max-w-[85%]"}>
                  <p className="mb-1 text-[10px] uppercase tracking-widest text-muted-foreground">
                    {m.role === "user" ? "Vous" : character.name} {m.saved && "· 📌"}
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
