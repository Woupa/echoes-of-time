import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, Home } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCharacter } from "@/lib/use-characters";

export const Route = createFileRoute("/shared/$token")({
  component: SharedConversation,
});

type SharedMessage = { id: string; role: "user" | "assistant"; content: string; created_at: string };
type SharedConversation = {
  id: string;
  character_id: string;
  title: string;
  created_at: string;
  updated_at: string;
  messages: SharedMessage[];
};

function SharedConversation() {
  const { token } = Route.useParams();
  const [conv, setConv] = useState<SharedConversation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase.rpc("get_shared_conversation", { _token: token });
      if (cancelled) return;
      if (error) {
        setError(error.message);
      } else if (!data) {
        setError("Cette conversation n'est plus partagée ou le lien est invalide.");
      } else {
        setConv(data as SharedConversation);
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [token]);

  const { character } = useCharacter(conv?.character_id ?? "");

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gold" />
      </div>
    );
  }

  if (error || !conv) {
    return (
      <div className="vignette mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6 text-center">
        <h1 className="font-display text-3xl text-gold">Lien introuvable</h1>
        <p className="mt-3 text-sm text-muted-foreground">{error ?? "Conversation indisponible."}</p>
        <Link to="/" className="mt-6 rounded-xl border border-border bg-card/60 px-4 py-2 text-xs uppercase tracking-widest hover:bg-accent">
          Accueil
        </Link>
      </div>
    );
  }

  const charName = character?.name ?? conv.title ?? "Personnage";

  return (
    <div className="vignette mx-auto flex min-h-screen max-w-2xl flex-col px-5 py-8">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {character?.avatar && (
            <img src={character.avatar} alt="" className="h-12 w-12 rounded-full object-cover ring-1 ring-gold/40" />
          )}
          <div>
            <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Conversation partagée</p>
            <h1 className="font-display text-2xl text-gold">{charName}</h1>
          </div>
        </div>
        <Link
          to="/"
          className="flex items-center gap-1.5 rounded-full border border-border bg-card/60 px-3 py-1.5 text-xs hover:bg-accent"
        >
          <Home className="h-3.5 w-3.5" /> Accueil
        </Link>
      </header>

      <div className="mt-6 flex-1 space-y-4 rounded-2xl border border-border bg-card/40 p-5 backdrop-blur">
        {conv.messages.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground">Aucun message dans cette conversation.</p>
        ) : (
          conv.messages.map((m) => (
            <div key={m.id} className={m.role === "user" ? "ml-auto max-w-[80%]" : "mr-auto max-w-[85%]"}>
              <p className="mb-1 text-[10px] uppercase tracking-widest text-muted-foreground">
                {m.role === "user" ? "Visiteur" : charName}
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
          ))
        )}
      </div>

      <p className="mt-6 text-center text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
        Lecture seule · Lien public
      </p>
    </div>
  );
}
