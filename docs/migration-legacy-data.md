# Legacy Data Migration

旧 `hakobin` データ(JSON) を `hakobin-re` PostgreSQL に投入する手順です。

## 1. JSON準備

`migrations/` 配下のサンプル形式に合わせて作成:

- `legacy.members.json`
- `legacy.payroll.json`
- `legacy.sales.json` (任意)

## 2. 実行

```bash
cd apps/backend
cp .env.example .env

# 例: members + payroll + sales を一括投入
npm run migrate:legacy -- \
  --members ../../migrations/legacy.members.json \
  --payroll ../../migrations/legacy.payroll.json \
  --sales ../../migrations/legacy.sales.json
```

## 3. 検証

1. `GET /api/v1/members`
2. `GET /api/v1/payroll/entries`
3. `GET /api/v1/payroll/sales-summary`

## 備考

- `accountUserId` があるメンバーは upsert（重複更新）
- `payroll_entries` は `id` で upsert
- 数値は `,` や `円` を除去して取り込み

