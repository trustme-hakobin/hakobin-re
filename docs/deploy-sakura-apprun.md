# Deploy: Sakura AppRun (backend)

## 1. Container Build

リポジトリルートで実行:

```bash
docker build -f apps/backend/Dockerfile -t hakobin-re-backend:latest .
```

## 2. AppRun Settings

環境変数を設定:

- `PORT=8080`
- `HOST=0.0.0.0`
- `CORS_ORIGIN=https://<frontend-domain>`
- `DB_HOST=<sakura-db-host>`
- `DB_PORT=5432`
- `DB_NAME=<db-name>`
- `DB_USER=<db-user>`
- `DB_PASSWORD=<db-password>`
- `DEV_BYPASS_AUTH=false`
- `FIREBASE_PROJECT_ID=<project-id>`
- `FIREBASE_CLIENT_EMAIL=<service-account-email>`
- `FIREBASE_PRIVATE_KEY=<service-account-private-key>`

## 3. Health Check

- path: `/health`
- expected: `200`

## 4. Post Deploy Check

1. `GET /health`
2. `GET /health/db`
3. `GET /api/v1/auth/me` (有効トークン付き)
4. `GET /api/v1/members`
5. `GET /api/v1/audit-logs`

