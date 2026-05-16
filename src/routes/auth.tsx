import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/select" });
    });
  }, [navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/select` },
        });
        if (error) throw error;
        // Auto-confirm enabled : la session est créée immédiatement
        if (data.session) {
          navigate({ to: "/select" });
        } else {
          // Tente une connexion directe (cas où la session n'est pas renvoyée)
          const { error: signinErr } = await supabase.auth.signInWithPassword({ email, password });
          if (signinErr) {
            setInfo("Compte créé. Connectez-vous avec votre email et mot de passe.");
          } else {
            navigate({ to: "/select" });
          }
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: "/select" });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  };

  const google = async () => {
    setError(null);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: `${window.location.origin}/select`,
    });
    if (result.error) setError(result.error.message);
  };

  return (
    <div className="vignette relative mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
      <Link to="/" className="absolute left-5 top-5 text-xs uppercase tracking-[0.3em] text-muted-foreground hover:text-gold">
        ← Accueil
      </Link>
      <h1 className="font-display text-4xl text-gold">
        {mode === "signin" ? "Connexion" : "Créer un compte"}
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Sauvegardez vos conversations avec les figures de l'Histoire.
      </p>

      <button
        onClick={google}
        className="mt-8 rounded-xl border border-border bg-card/60 px-4 py-3 text-sm backdrop-blur transition-colors hover:bg-accent"
      >
        Continuer avec Google
      </button>

      <div className="my-6 flex items-center gap-3 text-[10px] uppercase tracking-widest text-muted-foreground">
        <span className="h-px flex-1 bg-border" /> ou <span className="h-px flex-1 bg-border" />
      </div>

      <form onSubmit={submit} className="space-y-3">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          className="w-full rounded-xl border border-border bg-card/60 px-4 py-3 text-sm outline-none placeholder:text-muted-foreground focus:border-gold/60"
        />
        <input
          type="password"
          required
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Mot de passe (min. 6)"
          className="w-full rounded-xl border border-border bg-card/60 px-4 py-3 text-sm outline-none placeholder:text-muted-foreground focus:border-gold/60"
        />
        {error && <p className="text-xs text-destructive">{error}</p>}
        {info && <p className="text-xs text-gold">{info}</p>}
        <button
          type="submit"
          disabled={loading}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          {mode === "signin" ? "Se connecter" : "Créer le compte"}
        </button>
      </form>

      <button
        onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setError(null); setInfo(null); }}
        className="mt-6 text-center text-xs uppercase tracking-widest text-muted-foreground hover:text-gold"
      >
        {mode === "signin" ? "Pas de compte ? Créer" : "Déjà un compte ? Se connecter"}
      </button>
    </div>
  );
}
