create table if not exists members (
  id bigserial primary key,
  name text not null,
  account_user_id text unique,
  driver_ids text[] not null default '{}',
  office_names text[] not null default '{}',
  work_office text,
  position text,
  invoice_number text,
  vehicle_ownership text,
  cargo_insurance_status text,
  active boolean not null default true,
  inactive_reason text,
  inactive_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists payroll_entries (
  id text primary key,
  member_id bigint references members(id),
  driver_id text not null,
  month text not null,
  content text not null,
  unit_price numeric(12,2) not null default 0,
  quantity numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  status text not null default 'pending',
  statement_id text not null default 'default',
  statement_type text not null default 'driver',
  row_no integer,
  input_source text not null default 'manual',
  driver_note text not null default '',
  admin_note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists payroll_deductions (
  id bigserial primary key,
  driver_id text not null,
  month text not null,
  statement_id text not null default 'default',
  items jsonb not null default '[]'::jsonb,
  tax_settings jsonb not null default '{"mode":"none","rate":10}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (driver_id, month, statement_id)
);

create table if not exists payroll_sales_summaries (
  month text primary key,
  total numeric(14,2) not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists audit_logs (
  id bigserial primary key,
  actor_uid text,
  actor_email text,
  actor_role text,
  action text not null,
  target_type text not null,
  target_id text,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
