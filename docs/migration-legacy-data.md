# Legacy Data Migration

旧 `hakobin` データ(JSON) を `hakobin-re` PostgreSQL に投入する手順です。

## 1. JSON準備

`migrations/` 配下のサンプル形式に合わせて作成:

- `legacy.members.json`
- `legacy.payroll.json`
- `legacy.sales.json` (任意)

## 2. 実行

```bash
cp apps/backend/.env.example apps/backend/.env

# 1) DB接続確認
npm run db:check

# 2) テーブル初期化
npm run db:init

# 3) members + payroll + sales を一括投入
cd apps/backend
BASE="/absolute/path/to/migrations-export/<companyKey>/<timestamp>"
npm run migrate:legacy -- \
  --members "$BASE/legacy.members.json" \
  --payroll "$BASE/legacy.payroll.json" \
  --sales "$BASE/legacy.sales.json"

# 4) 移行検証
npm run verify:migration -- \
  --members "$BASE/legacy.members.json" \
  --payroll "$BASE/legacy.payroll.json" \
  --sales "$BASE/legacy.sales.json"
```

Supabaseを使う場合は `apps/backend/.env` に以下を設定:

```env
DB_HOST=<pooler host>
DB_PORT=5432
DB_NAME=postgres
DB_USER=<pooler user>
DB_PASSWORD="<db password>"
DB_SSL=true
```

## 3. 検証

1. `GET /api/v1/members`
2. `GET /api/v1/payroll/entries`
3. `GET /api/v1/payroll/sales-summary`

## 備考

- `accountUserId` があるメンバーは upsert（重複更新）
- `payroll_entries` は `id` で upsert
- 数値は `,` や `円` を除去して取り込み
- `content` が空の明細は `業務委託費` として取り込み
