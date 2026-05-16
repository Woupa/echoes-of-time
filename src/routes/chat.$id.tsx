import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { Mic, Keyboard, History, Film, Bookmark, PhoneOff, Send, X, Video, VideoOff } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { getCharacter } from "@/lib/characters";
import { useAvatarState } from "@/hooks/useAvatarState";
import { CharacterAvatar2D } from "@/components/CharacterAvatar2D";

export const Route = createFileRoute("/chat/$id")({
  component: Chat,
});

type Message = { role: "user" | "assistant"; content: string; saved?: boolean };

function Chat() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const character = getCharacter(id);

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [mode, setMode] = useState<"voice" | "text">("voice");
  const [videoOn, setVideoOn] = useState(true);
  const [showHistory, setShowHistory] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (character) {
      setMessages([{ role: "assistant", content: character.greeting }]);
      setIsSpeaking(true);
      const t = setTimeout(() => setIsSpeaking(false), 2400);
      return () => clearTimeout(t);
    }
  }, [character]);

  useEffect(() => {
    if (mode === "text") inputRef.current?.focus();
  }, [mode]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const lastAssistantText = [...messages].reverse().find((m) => m.role === "assistant")?.content;
  const avatarState = useAvatarState({
    isStreaming: isSpeaking,
    isLoading,
    lastAssistantText,
  });

  if (!character) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Link to="/select" className="text-gold underline">Retour</Link>
      </div>
    );
  }

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setMessages((m) => [...m, { role: "user", content: trimmed }]);
    setInput("");
    setIsLoading(true);

    // TODO: branche ici l'appel API (Sonnet via Vercel)
    // const res = await fetch("/api/chat", { method: "POST", body: JSON.stringify({ characterId: id, messages: [...messages, { role: "user", content: trimmed }] }) });
    setTimeout(() => {
      setIsLoading(false);
      setIsSpeaking(true);
      setMessages((m) => [
        ...m,
        { role: "assistant", content: `(${character.name} réfléchit…) — Connectez votre clé API Sonnet pour activer la réponse complète.` },
      ]);
      setTimeout(() => setIsSpeaking(false), 1800);
    }, 1200);
  };

  const last = messages[messages.length - 1];

  return (
    <div className="vignette relative flex min-h-screen flex-col overflow-hidden bg-background">
      {/* Background */}
      {!videoOn && (
        <>
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: `url(${character.avatar})`,
              backgroundSize: "cover",
              backgroundPosition: "center top",
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-background/40 via-background/60 to-background" />
        </>
      )}
      {videoOn && (
        <div
          className="absolute inset-0"
          style={{
            background: `radial-gradient(ellipse at top, color-mix(in oklab, ${character.accent} 18%, var(--background)) 0%, var(--background) 70%)`,
          }}
        />
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
              {isSpeaking ? "Parle…" : isLoading ? "Réfléchit…" : "En ligne · Pionnier"}
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowHistory(true)}
          className="rounded-full border border-border bg-card/60 px-3 py-1.5 text-xs backdrop-blur"
        >
          Historique
        </button>
      </header>

      {/* Full avatar (video mode) */}
      {videoOn && (
        <div className="relative z-10 mx-auto flex w-full max-w-md flex-1 items-center justify-center px-6">
          <div className="h-[60vh] w-full">
            <CharacterAvatar2D character={character} state={avatarState} size="full" />
          </div>
        </div>
      )}

      {/* Subtitle overlay */}
      <main
        className={
          videoOn
            ? "relative z-10 mx-auto w-full max-w-xl px-6 pb-44 text-center"
            : "relative z-10 flex flex-1 flex-col items-center justify-end px-6 pb-44"
        }
      >
        {last?.role === "assistant" && (
          <div
            key={messages.length}
            className={
              videoOn
                ? "animate-fade-up mx-auto rounded-2xl border border-border bg-card/70 px-5 py-3 backdrop-blur"
                : "animate-fade-up max-w-xl text-center"
            }
          >
            <p
              className={
                videoOn
                  ? "font-display text-lg leading-snug text-foreground"
                  : "font-display text-2xl leading-snug text-foreground drop-shadow-lg md:text-3xl"
              }
            >
              « {last.content} »
            </p>
            {!videoOn && (
              <p className="mt-3 text-xs uppercase tracking-[0.3em] text-gold/80">— {character.name}</p>
            )}
          </div>
        )}
        {last?.role === "user" && (
          <div className="animate-fade-up text-center">
            <p className="text-sm uppercase tracking-[0.3em] text-muted-foreground">Vous avez dit</p>
            <p className="mt-2 max-w-xl text-lg italic text-foreground/90">« {last.content} »</p>
          </div>
        )}
      </main>

      {/* PiP avatar when video is off */}
      {!videoOn && (
        <div className="absolute right-4 top-20 z-20 h-24 w-24 rounded-full border-2 shadow-cinema md:right-6 md:top-24 md:h-28 md:w-28"
          style={{ borderColor: character.accent }}
        >
          <CharacterAvatar2D character={character} state={avatarState} size="pip" />
        </div>
      )}

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

      {/* Action bar */}
      <div className="absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-background via-background/95 to-transparent pb-8 pt-12">
        <div className="mx-auto flex max-w-md items-center justify-around px-4">
          <ActionButton
            icon={mode === "voice" ? <Mic /> : <Keyboard />}
            label={mode === "voice" ? "Vocal" : "Clavier"}
            onClick={() => setMode(mode === "voice" ? "text" : "voice")}
            active
          />
          <ActionButton icon={<Film />} label="Scène" onClick={() => send("Imagine une scène : que feriez-vous aujourd'hui ?")} />

          <button
            onClick={() => navigate({ to: "/select" })}
            className="flex h-16 w-16 items-center justify-center rounded-full bg-hangup shadow-cinema transition-transform active:scale-95"
            aria-label="Raccrocher"
          >
            <PhoneOff className="h-6 w-6 text-white" />
          </button>

          <ActionButton
            icon={videoOn ? <Video /> : <VideoOff />}
            label={videoOn ? "Vidéo" : "Vidéo off"}
            onClick={() => setVideoOn((v) => !v)}
            active={videoOn}
          />
          <ActionButton
            icon={<Bookmark />}
            label="Mémo"
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
