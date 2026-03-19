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

## Local Setup (Recommended)

```bash
# 1) DB起動
docker compose up -d

# 2) backend env
cp apps/backend/.env.example apps/backend/.env
# 開発はまずこれでOK
# DEV_BYPASS_AUTH=true

# 3) frontend env
cp apps/frontend/.env.example apps/frontend/.env

# 4) 起動
npm run dev:backend
npm run dev:frontend
```

## DB Check / Init

```bash
# DB接続確認
npm run db:check

# テーブル初期化
npm run db:init
```

## Legacy Migration (from old hakobin JSON)

```bash
cd apps/backend

BASE="/absolute/path/to/migrations-export/<companyKey>/<timestamp>"
npm run migrate:legacy -- \
  --members "$BASE/legacy.members.json" \
  --payroll "$BASE/legacy.payroll.json" \
  --sales "$BASE/legacy.sales.json"

# 移行検証（件数突合せ + 未紐付け明細確認）
npm run verify:migration -- \
  --members "$BASE/legacy.members.json" \
  --payroll "$BASE/legacy.payroll.json" \
  --sales "$BASE/legacy.sales.json"
```

## Env

`apps/backend/.env.example` を `.env` にコピーして利用してください。

## Deploy

- backend(AppRun): `docs/deploy-sakura-apprun.md`
