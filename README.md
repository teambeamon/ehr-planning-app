# EHR Planning App

Une application pour gérer le planning des matchs de l'Entente Hettange Rodemack.

## Fonctionnalités
- Upload de fichiers Excel pour mettre à jour le planning.
- Affichage des matchs avec des filtres (équipe, lieu, saison, etc.).
- Statistiques (nombre de matchs par équipe, lieu, catégorie, mois).
- Adaptation automatique aux nouvelles équipes, salles, ou saisons.

## Technologies
- **Frontend** : Next.js (React), TanStack Table, Recharts, shadcn/ui.
- **Backend** : Next.js API Routes, Turso (via libSQL).
- **Parsing Excel** : SheetJS.
- **Hébergement** : Vercel.

## Configuration
1. Copiez `.env.local.example` en `.env.local` et remplissez les variables.
2. Installez les dépendances : `npm install`.
3. Lancez l'application : `npm run dev`.

## Déploiement
L'application est automatiquement déployée sur Vercel via GitHub Actions.
