# hakobin-re

`hakobin` の再構築用リポジトリです。  
`frontend / backend / db` を分離した構成で開始します。

## Structure

- `apps/frontend`: React + Vite
- `apps/backend`: Fastify API
- `packages/shared`: 共有ユーティリティ
- `db`: DBスキーマ(SQL)
- `docs`: 設計メモ

## Quick Start

```bash
npm install
npm run dev:backend
npm run dev:frontend
```

## Env

`apps/backend/.env.example` を `.env` にコピーして利用してください。

