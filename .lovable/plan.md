# Ajout du README

## Contexte

Le projet est synchronisé bidirectionnellement avec GitHub. Tout fichier `README.md` ajouté à la racine du repo Lovable sera automatiquement poussé sur GitHub — pas besoin d'action manuelle côté GitHub.

Aucun `README.md` n'existe actuellement à la racine.

## Ce que je vais faire

Créer **`README.md`** à la racine avec les sections suivantes :

1. **Titre + pitch** — app de conversation vocale/textuelle avec des personnages historiques générés par IA.
2. **Fonctionnalités** — création de personnage, chat texte, appel vocal, partage.
3. **Stack technique**
   - Frontend : TanStack Start v1, React 19, Vite 7, Tailwind v4, shadcn/ui
   - Backend : Lovable Cloud (Supabase) — auth, DB, storage
   - APIs externes :
     - **Pioneer** — LLM principal (génération personnage, casting, chat)
     - **Fal** — génération d'images (portraits + réactions)
     - **Gradium** — text-to-speech
     - **SLNG** — speech-to-text
     - ChatGPT en fallback silencieux
4. **Démarrage local** — `bun install`, `bun dev`, variables d'env nécessaires (références à `.env`).
5. **Structure du projet** — résumé court de `src/routes/`, `src/lib/`, `src/integrations/`.
6. **Déploiement** — via Lovable (bouton Publish).
7. **Lien projet Lovable**.

## Hors scope

- Pas de modification de code applicatif.
- Pas de doc d'API détaillée (juste les noms des providers).

Confirme-tu, ou veux-tu un ton/contenu différent (ex. anglais, plus court, plus technique) ?
