create table if not exists members (
  id bigserial primary key,
  name text not null,
  account_user_id text unique,
  invoice_number text,
  vehicle_ownership text,
  cargo_insurance_status text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists payroll_entries (
  id text primary key,
  member_id bigint references members(id),
  month text not null,
  content text not null,
  unit_price numeric(12,2) not null default 0,
  quantity numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

