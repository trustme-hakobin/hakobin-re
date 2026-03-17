# Architecture (Initial)

## Frontend

- React + Vite
- Backend APIのみを呼び出す（DB直アクセスしない）

## Backend

- Fastify API
- 認証: まずはFirebase Authトークン検証を後続で追加
- DBアクセス: PostgreSQL

## DB

- PostgreSQL
- 初期テーブル: `members`, `payroll_entries`

## Deployment Plan

- Frontend: 静的ホスティング
- Backend: さくらAppRun
- DB: さくらサーバー(PostgreSQL)

