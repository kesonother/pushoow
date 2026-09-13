# Pushoow

Plateforme SaaS calendar-first pour communautés tech, startup, AI et créateurs.

## Stack

- Next.js 16 (App Router) + TypeScript + Tailwind CSS 4
- PostgreSQL + Drizzle ORM (migrations versionnées)
- Better Auth (email / mot de passe)
- Vitest (domaine, API, autorisation) + Playwright (E2E)

## Démarrage local

```bash
cp .env.example .env.local
# Renseigner BETTER_AUTH_SECRET (openssl rand -base64 32)

docker compose up -d
npm install
npm run db:migrate
npm run dev
```

L’application écoute sur [http://localhost:3000](http://localhost:3000).

## Vérifications

```bash
npm test
npm run lint
npm run typecheck
```

## Architecture

La logique métier vit dans `src/domain`. Les routes UI et API ne font que composer des services. L’isolement multi-tenant et le RBAC sont toujours vérifiés côté serveur.
