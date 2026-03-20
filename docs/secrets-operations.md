# Secrets Operations

`hakobin-re` の秘密情報（DB/Firebaseキー）運用手順です。

## 1. 原則

- `.env` はコミットしない（`.gitignore` で除外済み）
- GitHub には `.env.example` のみ置く
- 本番はホスティング側の環境変数で管理する

## 2. ローカル設定

- backend: `apps/backend/.env`
- frontend: `apps/frontend/.env`

最低限の確認:

```bash
cd apps/backend
npm run db:check
```

## 3. Firebase秘密鍵ローテーション

1. Firebase Console > Project Settings > Service accounts
2. 新しい秘密鍵を発行
3. `FIREBASE_PRIVATE_KEY` を置き換え
4. 旧キーをFirebase側で無効化
5. backend再起動

## 4. 漏えい時の対応

1. Firebase秘密鍵を即ローテーション
2. DBパスワードを変更
3. `.env`更新後に `db:check` で接続確認
4. 関連サービス再起動

