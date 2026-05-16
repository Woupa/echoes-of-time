import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Plus, Search, Phone } from "lucide-react";
import { useState } from "react";
import { CHARACTERS } from "@/lib/characters";

export const Route = createFileRoute("/select")({
  component: Select,
});

function Select() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");

  const filtered = CHARACTERS.filter((c) =>
    c.name.toLowerCase().includes(query.toLowerCase()),
  );

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
            className="animate-fade-up"
            style={{ animationDelay: `${0.15 + i * 0.06}s` }}
          >
            <button
              onClick={() => navigate({ to: "/call/$id", params: { id: c.id } })}
              className="group flex w-full items-center gap-4 px-4 py-4 text-left transition-colors hover:bg-accent/40"
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
              </div>
              <div className="flex-1">
                <p className="font-display text-lg text-foreground">{c.name}</p>
                <p className="text-xs text-muted-foreground">{c.title} · {c.era}</p>
              </div>
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-call/10 text-[oklch(0.8_0.15_145)] opacity-0 transition-opacity group-hover:opacity-100">
                <Phone className="h-4 w-4" />
              </span>
            </button>
          </li>
        ))}

        <li className="animate-fade-up" style={{ animationDelay: `${0.15 + filtered.length * 0.06}s` }}>
          <button
            onClick={() => navigate({ to: "/call/$id", params: { id: "custom" } })}
            className="flex w-full items-center gap-4 px-4 py-4 text-left transition-colors hover:bg-accent/40"
          >
            <div className="flex h-14 w-14 items-center justify-center rounded-full border border-dashed border-gold/50 text-gold">
              <Plus className="h-6 w-6" />
            </div>
            <div className="flex-1">
              <p className="font-display text-lg text-gold">Créer un personnage</p>
              <p className="text-xs text-muted-foreground">Définissez nom, époque, personnalité</p>
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
