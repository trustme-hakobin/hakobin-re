# API v1

## Auth

- `GET /api/v1/auth/me`

## Members

- `GET /api/v1/members`
- `GET /api/v1/members/:id`
- `POST /api/v1/members`
- `PATCH /api/v1/members/:id`
- `POST /api/v1/members/:id/deactivate`
- `POST /api/v1/members/:id/activate`

## Payroll

- `GET /api/v1/payroll/entries`
- `GET /api/v1/payroll/summary`
- `POST /api/v1/payroll/import/details`
- `POST /api/v1/payroll/import/sales-summary`
- `GET /api/v1/payroll/deductions`
- `PUT /api/v1/payroll/deductions`

## Notes

- 認証は `Authorization: Bearer <Firebase ID token>`
- 開発時は `.env` の `DEV_BYPASS_AUTH=true` でバイパス可能

