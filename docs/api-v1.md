# API v1

## Auth

- `GET /api/v1/auth/me`
- `GET /api/v1/audit-logs`

## Members

- `GET /api/v1/members`
- `GET /api/v1/members/:id`
- `POST /api/v1/members`
- `PATCH /api/v1/members/:id`
- `POST /api/v1/members/:id/deactivate`
- `POST /api/v1/members/:id/activate`

## Payroll

- `GET /api/v1/payroll/entries`
- `POST /api/v1/payroll/entries`
- `PATCH /api/v1/payroll/entries/:id`
- `DELETE /api/v1/payroll/entries/:id`
- `GET /api/v1/payroll/summary`
- `POST /api/v1/payroll/import/details`
- `POST /api/v1/payroll/import/sales-summary`
- `GET /api/v1/payroll/deductions`
- `PUT /api/v1/payroll/deductions`

## Notes

- 認証は `Authorization: Bearer <Firebase ID token>`
- 開発時は `.env` の `DEV_BYPASS_AUTH=true` でバイパス可能
- 更新系APIは `audit_logs` に自動記録
