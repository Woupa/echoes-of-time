import { createFileRoute, useNavigate } from "@tanstack/react-router";
import austerlitz from "@/assets/austerlitz.jpg";

export const Route = createFileRoute("/")({
  component: Splash,
});

function Splash() {
  const navigate = useNavigate();

  return (
    <button
      onClick={() => navigate({ to: "/select" })}
      className="vignette relative flex min-h-screen w-full flex-col items-center justify-center overflow-hidden bg-background px-6"
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
        {/* Ornate painting frame */}
        <div className="relative">
          <div
            className="absolute -inset-6 rounded-sm blur-2xl"
            style={{ background: "var(--color-gold)", opacity: 0.18 }}
          />
          <div
            className="relative rounded-[2px] p-3 shadow-cinema"
            style={{
              background:
                "linear-gradient(135deg, oklch(0.78 0.14 80) 0%, oklch(0.55 0.12 60) 25%, oklch(0.82 0.16 85) 50%, oklch(0.45 0.10 55) 75%, oklch(0.72 0.13 75) 100%)",
              boxShadow:
                "0 0 0 1px oklch(0.30 0.05 60), 0 30px 80px -20px rgba(0,0,0,0.8), inset 0 0 0 1px oklch(0.92 0.08 85 / 0.4)",
            }}
          >
            <div
              className="rounded-[1px] p-2"
              style={{
                background:
                  "linear-gradient(135deg, oklch(0.62 0.12 65), oklch(0.40 0.08 55))",
                boxShadow:
                  "inset 0 0 0 1px oklch(0.85 0.10 80 / 0.5), inset 0 0 20px rgba(0,0,0,0.4)",
              }}
            >
              <div
                className="overflow-hidden"
                style={{
                  boxShadow:
                    "inset 0 0 0 1px rgba(0,0,0,0.6), inset 0 0 40px rgba(0,0,0,0.5)",
                }}
              >
                <img
                  src={austerlitz}
                  alt="Echoes of Time"
                  className="block h-auto w-[min(520px,80vw)] object-cover"
                />
              </div>
            </div>
          </div>
        </div>

        <h1 className="mt-10 font-display text-5xl tracking-wide text-foreground md:text-7xl">
          Echoes of Time
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
