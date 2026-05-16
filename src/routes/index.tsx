import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

export const Route = createFileRoute("/")({
  component: Splash,
});

function Splash() {
  const navigate = useNavigate();

  useEffect(() => {
    const t = setTimeout(() => navigate({ to: "/select" }), 3200);
    return () => clearTimeout(t);
  }, [navigate]);

  return (
    <button
      onClick={() => navigate({ to: "/select" })}
      className="vignette relative flex min-h-screen w-full flex-col items-center justify-center overflow-hidden bg-background"
    >
      {/* Ambient grain */}
      <div
        className="pointer-events-none absolute inset-0 opacity-20 mix-blend-overlay"
        style={{
          backgroundImage:
            "radial-gradient(circle at 20% 30%, oklch(0.82 0.15 80 / 0.15), transparent 40%), radial-gradient(circle at 80% 70%, oklch(0.5 0.15 30 / 0.15), transparent 40%)",
        }}
      />

      <div className="animate-reveal flex flex-col items-center">
        <div className="relative">
          <div className="absolute inset-0 animate-breathe rounded-full blur-3xl" style={{ background: "var(--color-gold)", opacity: 0.25 }} />
          <div className="relative flex h-32 w-32 items-center justify-center rounded-full border border-gold/30 bg-card shadow-cinema">
            <span className="font-display text-5xl text-gold">P</span>
          </div>
        </div>

        <h1 className="mt-10 font-display text-6xl tracking-wide text-foreground md:text-7xl">
          Pionnier
        </h1>
        <p className="mt-4 text-sm uppercase tracking-[0.4em] text-muted-foreground">
          L'Histoire prend la parole
        </p>
      </div>

      <p className="absolute bottom-10 text-xs uppercase tracking-[0.3em] text-muted-foreground/70">
        Touchez pour entrer
      </p>
    </button>
  );
}
