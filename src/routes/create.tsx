import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { ArrowLeft, Sparkles, Loader2 } from "lucide-react";
import { generateCharacter } from "@/lib/character-generation.functions";
import { useQueryClient } from "@tanstack/react-query";

export const Route = createFileRoute("/create")({
  component: CreatePage,
});

const STEPS = [
  "Analyse du personnage par l'IA…",
  "Écriture de la personnalité…",
  "Choix des 6 réactions emblématiques…",
  "Génération des portraits par Fal…",
  "Mise en scène cinématique…",
];

function CreatePage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const create = useServerFn(generateCharacter);

  const [name, setName] = useState("");
  const [era, setEra] = useState("");
  const [userContext, setUserContext] = useState("");
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    setStep(0);
    // Stepper purement visuel
    const interval = setInterval(() => {
      setStep((s) => Math.min(s + 1, STEPS.length - 1));
    }, 3500);
    try {
      const res = (await create({ data: { name, era, userContext } })) as { id: string };
      clearInterval(interval);
      await qc.invalidateQueries({ queryKey: ["custom-characters"] });
      navigate({ to: "/call/$id", params: { id: res.id } });
    } catch (err) {
      clearInterval(interval);
      setError(err instanceof Error ? err.message : "Erreur inconnue");
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col px-5 pb-12 pt-8">
      <Link
        to="/select"
        className="mb-6 inline-flex w-fit items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Contacts
      </Link>

      <header className="animate-fade-up">
        <p className="text-xs uppercase tracking-[0.3em] text-gold/80">Nouveau contact</p>
        <h1 className="mt-2 font-display text-4xl">Donnez vie à un personnage</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          L'IA enrichit votre description, choisit 6 réactions emblématiques, puis Fal génère les portraits cinématiques.
        </p>
      </header>

      {!loading ? (
        <form onSubmit={submit} className="animate-fade-up mt-8 space-y-5" style={{ animationDelay: "0.1s" }}>
          <div>
            <label className="mb-2 block text-xs uppercase tracking-widest text-muted-foreground">Nom</label>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Cléopâtre VII"
              className="w-full rounded-xl border border-border bg-card/50 px-4 py-3 text-sm outline-none focus:border-gold/50"
            />
          </div>
          <div>
            <label className="mb-2 block text-xs uppercase tracking-widest text-muted-foreground">Époque</label>
            <input
              required
              value={era}
              onChange={(e) => setEra(e.target.value)}
              placeholder="-69 / -30 av. J.-C."
              className="w-full rounded-xl border border-border bg-card/50 px-4 py-3 text-sm outline-none focus:border-gold/50"
            />
          </div>
          <div>
            <label className="mb-2 block text-xs uppercase tracking-widest text-muted-foreground">
              Contexte & personnalité
            </label>
            <textarea
              required
              minLength={10}
              maxLength={2000}
              rows={6}
              value={userContext}
              onChange={(e) => setUserContext(e.target.value)}
              placeholder="Dernière reine d'Égypte, polyglotte, stratège politique. Sait charmer comme menacer. Parle avec malice, références à Alexandrie, au Nil, à César et Marc Antoine…"
              className="w-full resize-none rounded-xl border border-border bg-card/50 px-4 py-3 text-sm leading-relaxed outline-none focus:border-gold/50"
            />
            <p className="mt-1 text-right text-[10px] text-muted-foreground">{userContext.length} / 2000</p>
          </div>

          {error && (
            <div className="rounded-xl border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <button
            type="submit"
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-gold to-primary px-6 py-4 font-display text-lg text-primary-foreground shadow-cinema transition-transform active:scale-[0.98]"
          >
            <Sparkles className="h-5 w-5" />
            Donner vie au personnage
          </button>
          <p className="text-center text-[11px] text-muted-foreground">
            ≈ 30 à 60 secondes (ChatGPT + 7 images Fal)
          </p>
        </form>
      ) : (
        <div className="animate-fade-up mt-12 flex flex-col items-center text-center">
          <div className="relative">
            <span className="absolute inset-0 animate-pulse-ring rounded-full border-2 border-gold/40" />
            <div className="flex h-32 w-32 items-center justify-center rounded-full border border-gold/40 bg-card shadow-cinema">
              <Loader2 className="h-10 w-10 animate-spin text-gold" />
            </div>
          </div>

          <h2 className="mt-10 font-display text-3xl text-foreground">Conjuration en cours…</h2>
          <p className="mt-2 text-sm text-muted-foreground">{name} prend forme</p>

          <ul className="mt-10 w-full max-w-sm space-y-3">
            {STEPS.map((s, i) => (
              <li
                key={i}
                className={`flex items-center gap-3 rounded-lg border px-4 py-3 text-sm transition-colors ${
                  i < step
                    ? "border-gold/30 bg-gold/5 text-foreground/70"
                    : i === step
                      ? "border-gold/60 bg-gold/10 text-foreground"
                      : "border-border text-muted-foreground/50"
                }`}
              >
                <span
                  className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] ${
                    i < step
                      ? "bg-gold/40 text-background"
                      : i === step
                        ? "bg-gold text-background"
                        : "bg-muted"
                  }`}
                >
                  {i < step ? "✓" : i + 1}
                </span>
                {s}
              </li>
            ))}
          </ul>

          {error && (
            <div className="mt-6 rounded-xl border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
