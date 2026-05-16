# Historical Personas

Application de conversation (texte + vocal) avec des personnages historiques générés par IA. Crée un personnage à partir d'un nom, obtiens un portrait, une voix, une personnalité — puis discute ou appelle-le en temps réel.

> Projet Lovable : https://lovable.dev/projects/583e94c6-65f7-4d86-bfaa-b9156c9a9d28

## Fonctionnalités

- **Création de personnage** à partir d'un nom (bio, traits, ton de voix, portrait)
- **Galerie de réactions** — 6 portraits émotionnels par personnage
- **Chat texte** conversationnel persistant
- **Appel vocal** temps réel (STT → LLM → TTS)
- **Partage** d'un personnage via lien public
- **Authentification** email + Google

## Stack technique

### Frontend
- [TanStack Start v1](https://tanstack.com/start) (SSR, file-based routing, server functions)
- React 19, Vite 7
- Tailwind CSS v4 + shadcn/ui (Radix)
- Déploiement Cloudflare Workers

### Backend
- **Lovable Cloud** (Supabase managé) — auth, Postgres + RLS, storage
- Server functions TanStack (`createServerFn`) pour toute la logique serveur

### APIs externes
| Provider | Usage |
|---|---|
| **Pioneer** | LLM principal (génération de personnage, casting de voix, génération SVG, chat) |
| **Fal** (`flux-pro/v1.1`) | Génération d'images (portrait + 6 réactions) |
| **Gradium** | Text-to-speech (synthèse vocale) |
| **SLNG** (Deepgram nova-3) | Speech-to-text (auto-détection FR/EN) |
| OpenAI / ChatGPT | Fallback silencieux si Pioneer échoue |

## Démarrage local

```bash
bun install
bun dev
```

L'application démarre sur `http://localhost:8080`.

### Variables d'environnement

Le fichier `.env` est généré automatiquement par Lovable Cloud (Supabase URL + clé publishable). Les clés API serveur (Pioneer, Fal, Gradium, SLNG, OpenAI) sont gérées via les **secrets** Lovable Cloud et accessibles via `process.env.*` dans les server functions.

## Structure du projet

```
src/
├── routes/              # File-based routing (TanStack)
│   ├── index.tsx        # Splash / accueil
│   ├── select.tsx       # Liste des personnages
│   ├── create.tsx       # Création d'un personnage
│   ├── chat.$id.tsx     # Chat texte
│   ├── call.$id.tsx     # Appel vocal
│   └── shared.$token.tsx
├── lib/
│   ├── character-generation.functions.ts  # Server fns : Pioneer + Fal + Gradium + SLNG
│   ├── characters.ts    # Accès DB personnages
│   └── use-*.ts         # Hooks React
├── integrations/supabase/  # Clients auto-générés (NE PAS éditer)
└── styles.css           # Design tokens (oklch)
```

## Déploiement

Publier via l'éditeur Lovable (bouton **Publish** en haut à droite). Les server functions et l'app statique sont déployées sur Cloudflare Workers.

## Synchronisation GitHub

Le repo est synchronisé bidirectionnellement avec Lovable : tout commit pushé sur GitHub est répercuté dans l'éditeur, et inversement.
