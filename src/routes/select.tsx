import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { Plus, Search, Phone, Sparkles, Trash2, LogIn, LogOut, User } from "lucide-react";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { useAllCharacters } from "@/lib/use-characters";
import { deleteCustomCharacter } from "@/lib/character-generation.functions";
import { useAuth } from "@/lib/use-auth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/select")({
  component: Select,
});

function Select() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const { all, isLoading } = useAllCharacters();
  const removeFn = useServerFn(deleteCustomCharacter);
  const qc = useQueryClient();
  const { user } = useAuth();

  const filtered = all.filter((c) => c.name.toLowerCase().includes(query.toLowerCase()));

  const confirmDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await removeFn({ data: { id } });
      await qc.invalidateQueries({ queryKey: ["custom-characters"] });
    } catch (err) {
      console.error("Delete failed:", err);
    } finally {
      setDeletingId(null);
      setPendingDelete(null);
    }
  };

  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col px-4 pb-12 pt-10">
      <header className="animate-fade-up">
        <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Contacts historiques</p>
        <h1 className="mt-2 font-display text-4xl text-foreground">Qui voulez-vous appeler ?</h1>
      </header>

      <div className="animate-fade-up mt-6 flex items-center gap-3 rounded-2xl border border-border bg-card/50 px-4 py-3 backdrop-blur" style={{ animationDelay: "0.1s" }}>
        <Search className="h-4 w-4 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Rechercher un personnage…"
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
      </div>

      <ul className="mt-6 divide-y divide-border rounded-2xl border border-border bg-card/30 backdrop-blur">
        {filtered.map((c, i) => (
          <li
            key={c.id}
            className="animate-fade-up group/row relative"
            style={{ animationDelay: `${0.15 + i * 0.06}s` }}
          >
            <button
              onClick={() => navigate({ to: "/call/$id", params: { id: c.id } })}
              className="group flex w-full items-center gap-4 px-4 py-4 pr-16 text-left transition-colors hover:bg-accent/40"
            >
              <div className="relative">
                <div
                  className="absolute -inset-0.5 rounded-full opacity-0 blur-md transition-opacity group-hover:opacity-60"
                  style={{ background: c.accent }}
                />
                <img
                  src={c.avatar}
                  alt={c.name}
                  width={56}
                  height={56}
                  loading="lazy"
                  className="relative h-14 w-14 rounded-full object-cover ring-1 ring-border"
                />
                {c.isCustom && (
                  <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-gold text-background">
                    <Sparkles className="h-3 w-3" />
                  </span>
                )}
              </div>
              <div className="flex-1">
                <p className="font-display text-lg text-foreground">{c.name}</p>
                <p className="text-xs text-muted-foreground">{c.title} · {c.era}</p>
              </div>
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-call/10 text-[oklch(0.8_0.15_145)] opacity-0 transition-opacity group-hover:opacity-100">
                <Phone className="h-4 w-4" />
              </span>
            </button>

            {c.isCustom && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                {pendingDelete === c.id ? (
                  <div className="flex items-center gap-1 rounded-full bg-card px-2 py-1 shadow-cinema ring-1 ring-destructive/50">
                    <button
                      onClick={(e) => { e.stopPropagation(); confirmDelete(c.id); }}
                      disabled={deletingId === c.id}
                      className="rounded-full bg-destructive px-2 py-1 text-[10px] uppercase tracking-wider text-destructive-foreground disabled:opacity-50"
                    >
                      {deletingId === c.id ? "…" : "Confirmer"}
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setPendingDelete(null); }}
                      className="rounded-full px-2 py-1 text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground"
                    >
                      Annuler
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={(e) => { e.stopPropagation(); setPendingDelete(c.id); }}
                    aria-label={`Supprimer ${c.name}`}
                    className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground opacity-0 transition-all hover:bg-destructive/15 hover:text-destructive group-hover/row:opacity-100"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            )}
          </li>
        ))}

        {isLoading && (
          <li className="px-4 py-6 text-center text-xs text-muted-foreground">Chargement des contacts…</li>
        )}

        <li className="animate-fade-up" style={{ animationDelay: `${0.15 + filtered.length * 0.06}s` }}>
          <button
            onClick={() => navigate({ to: "/create" })}
            className="flex w-full items-center gap-4 px-4 py-4 text-left transition-colors hover:bg-accent/40"
          >
            <div className="flex h-14 w-14 items-center justify-center rounded-full border border-dashed border-gold/50 text-gold">
              <Plus className="h-6 w-6" />
            </div>
            <div className="flex-1">
              <p className="font-display text-lg text-gold">Créer un personnage</p>
              <p className="text-xs text-muted-foreground">L'IA génère personnalité, voix et 6 réactions</p>
            </div>
          </button>
        </li>
      </ul>

      <p className="mt-8 text-center text-xs text-muted-foreground/70">
        Propulsé par Sonnet · Sélectionnez un contact pour lancer l'appel
      </p>
    </div>
  );
}
