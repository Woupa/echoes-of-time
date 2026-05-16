import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { Phone, PhoneOff, ArrowLeft } from "lucide-react";
import { getCharacter } from "@/lib/characters";

export const Route = createFileRoute("/call/$id")({
  component: IncomingCall,
});

function IncomingCall() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const character = getCharacter(id);

  if (!character) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Link to="/select" className="text-gold underline">Retour aux contacts</Link>
      </div>
    );
  }

  return (
    <div className="vignette relative flex min-h-screen flex-col items-center justify-between overflow-hidden bg-background px-6 py-12">
      {/* Backdrop blur of avatar */}
      <div
        className="absolute inset-0 opacity-40"
        style={{
          backgroundImage: `url(${character.avatar})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          filter: "blur(60px) saturate(1.2)",
        }}
      />
      <div className="absolute inset-0 bg-background/70" />

      <div className="relative animate-fade-up text-center">
        <p className="text-xs uppercase tracking-[0.4em] text-muted-foreground">Appel entrant</p>
        <p className="mt-2 font-display text-2xl text-foreground/90">Pionnier · Ligne historique</p>
      </div>

      <div className="relative flex flex-col items-center">
        <div className="relative">
          <span className="absolute inset-0 animate-pulse-ring rounded-full border-2" style={{ borderColor: character.accent }} />
          <span className="absolute inset-0 animate-pulse-ring rounded-full border-2" style={{ borderColor: character.accent, animationDelay: "0.6s" }} />
          <span className="absolute inset-0 animate-pulse-ring rounded-full border-2" style={{ borderColor: character.accent, animationDelay: "1.2s" }} />
          <img
            src={character.avatar}
            alt={character.name}
            width={224}
            height={224}
            className="relative h-56 w-56 rounded-full object-cover shadow-cinema ring-2 ring-gold/40"
          />
        </div>
        <h1 className="mt-10 font-display text-5xl text-foreground">{character.name}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{character.title}</p>
        <p className="mt-1 text-xs uppercase tracking-[0.3em] text-gold/80">{character.era}</p>
      </div>

      <div className="relative flex w-full max-w-sm items-center justify-around">
        <button
          onClick={() => navigate({ to: "/select" })}
          className="flex flex-col items-center gap-2"
        >
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-hangup shadow-cinema transition-transform active:scale-95">
            <PhoneOff className="h-7 w-7 text-white" />
          </span>
          <span className="text-xs text-muted-foreground">Refuser</span>
        </button>

        <button
          onClick={() => navigate({ to: "/chat/$id", params: { id } })}
          className="flex flex-col items-center gap-2"
        >
          <span className="animate-shake flex h-16 w-16 items-center justify-center rounded-full bg-call shadow-cinema glow-gold transition-transform active:scale-95">
            <Phone className="h-7 w-7 text-white" />
          </span>
          <span className="text-xs text-foreground">Décrocher</span>
        </button>
      </div>
    </div>
  );
}
