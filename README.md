# NeuroLab

PWA de treinamento cognitivo, funções executivas e raciocínio lógico (sem alegações médicas/clínicas), rodando 100% localmente via Docker e pronto para nuvem.

## Stack
- **Front-end:** React + TypeScript + Tailwind CSS + Vite + PWA (`vite-plugin-pwa`) + Recharts + Web Audio API.
- **Back-end local:** Docker Compose enxuto (`postgres:16-alpine` + GoTrue Auth + PostgREST + Kong na porta `54321`), 100% compatível com `@supabase/supabase-js` e `supabase/config.toml`.
- **Dual-Theme:** `Gamificado` (padrão) e `Minimalista` via `data-theme`.

## Como rodar local

### 1. Subir o back-end no Docker (com Docker Desktop aberto)
```powershell
docker compose up -d
```
*(Ou via Supabase CLI: `npx.cmd supabase start`.)*

### 2. Rodar o app no navegador
```powershell
npm.cmd run dev
```
Abra `http://localhost:5173` no Google Chrome. O botão **Acesso Rápido Local** funciona mesmo se o Docker estiver desligado.

## Migrar para a nuvem (Supabase Cloud)
Basta rodar a migration em `supabase/migrations/20261121000000_initial_schema.sql` no seu projeto Supabase e trocar `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` no `.env.local`.
