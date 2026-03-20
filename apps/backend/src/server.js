import dotenv from 'dotenv';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import pg from 'pg';
import admin from 'firebase-admin';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createDbPoolConfig } from './db-config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const toBool = (value) => String(value || '').toLowerCase() === 'true';

const requireEnv = (name, options = {}) => {
  const value = String(process.env[name] || '').trim();
  if (value) return value;
  if (options.optional) return '';
  throw new Error(`Missing required env: ${name}`);
};

const validateRequiredEnv = () => {
  requireEnv('DB_HOST');
  requireEnv('DB_PORT');
  requireEnv('DB_NAME');
  requireEnv('DB_USER');
  requireEnv('DB_PASSWORD');
  requireEnv('CORS_ORIGIN');

  if (!toBool(process.env.DEV_BYPASS_AUTH)) {
    requireEnv('FIREBASE_PROJECT_ID');
    requireEnv('FIREBASE_CLIENT_EMAIL');
    requireEnv('FIREBASE_PRIVATE_KEY');
  }
};

validateRequiredEnv();

const app = Fastify({ logger: true });
await app.register(cors, { origin: process.env.CORS_ORIGIN || true });

const pool = new pg.Pool(createDbPoolConfig());
const normalizeMonth = (value) => String(value || '').trim();
const parseNumeric = (value) => {
  const raw = String(value ?? '').trim();
  if (!raw) return 0;
  const normalized = raw.replace(/,/g, '').replace(/円/g, '').replace(/[^\d.-]/g, '');
  const num = Number(normalized);
  return Number.isFinite(num) ? num : 0;
};
const isValidInvoiceNumber = (value) => /^T\d{13}$/i.test(String(value || '').trim());
const ok = (data) => ({ ok: true, data });
const fail = (code, message) => ({ ok: false, error: { code, message } });
const toSafeJson = (value) => {
  try {
    return JSON.stringify(value ?? {});
  } catch {
    return JSON.stringify({ note: 'unserializable' });
  }
};

let firebaseReady = false;
if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
  const privateKey = process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n');
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey
    })
  });
  firebaseReady = true;
}

const authGuard = async (request, reply) => {
  if (toBool(process.env.DEV_BYPASS_AUTH)) {
    request.user = {
      uid: process.env.DEV_ADMIN_UID || 'local-admin',
      email: process.env.DEV_ADMIN_EMAIL || 'admin@local',
      role: 'admin',
      claims: { role: 'admin' }
    };
    return;
  }
  const authHeader = String(request.headers.authorization || '');
  if (!authHeader.startsWith('Bearer ')) {
    return reply.code(401).send(fail('unauthorized', 'Authorization header is required.'));
  }
  if (!firebaseReady) {
    return reply.code(500).send(fail('auth_not_configured', 'Firebase auth is not configured.'));
  }
  try {
    const token = authHeader.slice(7).trim();
    const decoded = await admin.auth().verifyIdToken(token);
    request.user = {
      uid: decoded.uid,
      email: decoded.email || '',
      role: decoded.role || 'driver',
      claims: decoded
    };
  } catch (error) {
    request.log.error(error);
    return reply.code(401).send(fail('invalid_token', 'Token verification failed.'));
  }
};

const requireAdmin = async (request, reply) => {
  const role = String(request.user?.role || '').toLowerCase();
  if (role !== 'admin' && role !== 'manager') {
    return reply.code(403).send(fail('forbidden', 'Admin role is required.'));
  }
};

const initDb = async () => {
  await pool.query(`
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
  `);

  await pool.query(`
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
  `);

  await pool.query(`
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
  `);

  await pool.query(`
    create table if not exists payroll_sales_summaries (
      month text primary key,
      total numeric(14,2) not null default 0,
      updated_at timestamptz not null default now()
    );
  `);

  await pool.query(`
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
  `);
};

const writeAuditLog = async (request, action, targetType, targetId = '', meta = {}) => {
  const actor = request.user || {};
  await pool.query(
    `insert into audit_logs
      (actor_uid, actor_email, actor_role, action, target_type, target_id, meta, created_at)
      values ($1,$2,$3,$4,$5,$6,$7,now())`,
    [
      String(actor.uid || ''),
      String(actor.email || ''),
      String(actor.role || ''),
      String(action || ''),
      String(targetType || ''),
      String(targetId || ''),
      toSafeJson(meta)
    ]
  );
};

app.get('/health', async () => ok({ service: 'backend', status: 'up' }));
app.get('/health/db', async (request, reply) => {
  try {
    const result = await pool.query('select now() as now');
    return ok({ now: result.rows[0]?.now });
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send(fail('db_error', 'DB health check failed.'));
  }
});

app.get('/api/v1/auth/me', { preHandler: [authGuard] }, async (request) => {
  const member = await pool.query(
    'select id, name, account_user_id, position, active from members where account_user_id = $1 limit 1',
    [request.user.uid]
  );
  const memberRow = member.rows[0] || null;
  return ok({
    uid: request.user.uid,
    email: request.user.email,
    role: request.user.role,
    memberId: memberRow?.id || null,
    member: memberRow
  });
});

app.get('/api/v1/audit-logs', { preHandler: [authGuard, requireAdmin] }, async (request, reply) => {
  try {
    const page = Math.max(1, Number(request.query.page || 1));
    const limit = Math.max(1, Math.min(200, Number(request.query.limit || 50)));
    const offset = (page - 1) * limit;
    const action = String(request.query.action || '').trim();
    const targetType = String(request.query.targetType || '').trim();
    const q = String(request.query.q || '').trim();

    const where = [];
    const values = [];
    if (action) {
      values.push(action);
      where.push(`action = $${values.length}`);
    }
    if (targetType) {
      values.push(targetType);
      where.push(`target_type = $${values.length}`);
    }
    if (q) {
      values.push(`%${q}%`);
      where.push(`(actor_uid ilike $${values.length} or actor_email ilike $${values.length} or target_id ilike $${values.length})`);
    }
    const whereSql = where.length > 0 ? `where ${where.join(' and ')}` : '';

    const countResult = await pool.query(`select count(*)::int as count from audit_logs ${whereSql}`, values);
    values.push(limit, offset);
    const result = await pool.query(
      `select * from audit_logs ${whereSql}
       order by created_at desc
       limit $${values.length - 1} offset $${values.length}`,
      values
    );
    return ok({
      items: result.rows,
      page,
      limit,
      total: countResult.rows[0]?.count || 0
    });
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send(fail('audit_log_list_failed', 'Failed to fetch audit logs.'));
  }
});

app.get('/api/v1/members', { preHandler: [authGuard, requireAdmin] }, async (request, reply) => {
  try {
    const q = String(request.query.q || '').trim();
    const status = String(request.query.status || 'all').trim();
    const page = Math.max(1, Number(request.query.page || 1));
    const limit = Math.max(1, Math.min(200, Number(request.query.limit || 50)));
    const offset = (page - 1) * limit;

    const where = [];
    const values = [];
    if (q) {
      values.push(`%${q}%`);
      where.push(`(name ilike $${values.length} or account_user_id ilike $${values.length})`);
    }
    if (status === 'active') where.push('active = true');
    if (status === 'inactive') where.push('active = false');

    const whereSql = where.length > 0 ? `where ${where.join(' and ')}` : '';
    const countResult = await pool.query(`select count(*)::int as count from members ${whereSql}`, values);
    values.push(limit, offset);
    const list = await pool.query(
      `select * from members ${whereSql} order by updated_at desc limit $${values.length - 1} offset $${values.length}`,
      values
    );
    return ok({
      items: list.rows,
      page,
      limit,
      total: countResult.rows[0]?.count || 0
    });
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send(fail('members_list_failed', 'Failed to fetch members.'));
  }
});

app.get('/api/v1/members/:id', { preHandler: [authGuard, requireAdmin] }, async (request, reply) => {
  const result = await pool.query('select * from members where id = $1 limit 1', [request.params.id]);
  if (!result.rows[0]) return reply.code(404).send(fail('not_found', 'Member not found.'));
  return ok(result.rows[0]);
});

app.post('/api/v1/members', { preHandler: [authGuard, requireAdmin] }, async (request, reply) => {
  try {
    const body = request.body || {};
    const name = String(body.name || '').trim();
    if (!name) return reply.code(400).send(fail('invalid_request', 'name is required.'));
    const result = await pool.query(
      `insert into members
      (name, account_user_id, driver_ids, office_names, work_office, position, invoice_number, vehicle_ownership, cargo_insurance_status)
      values ($1,$2,$3,$4,$5,$6,$7,$8,$9) returning *`,
      [
        name,
        String(body.accountUserId || '').trim() || null,
        Array.isArray(body.driverIds) ? body.driverIds.map(String) : [],
        Array.isArray(body.officeNames) ? body.officeNames.map(String) : [],
        String(body.workOffice || '').trim() || null,
        String(body.position || '').trim() || null,
        String(body.invoiceNumber || '').trim() || null,
        String(body.vehicleOwnership || '').trim() || null,
        String(body.cargoInsuranceStatus || '').trim() || null
      ]
    );
    await writeAuditLog(request, 'create', 'member', String(result.rows[0]?.id || ''), {
      name: result.rows[0]?.name || ''
    });
    return reply.code(201).send(ok(result.rows[0]));
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send(fail('member_create_failed', 'Failed to create member.'));
  }
});

app.patch('/api/v1/members/:id', { preHandler: [authGuard, requireAdmin] }, async (request, reply) => {
  try {
    const current = await pool.query('select * from members where id = $1 limit 1', [request.params.id]);
    if (!current.rows[0]) return reply.code(404).send(fail('not_found', 'Member not found.'));
    const prev = current.rows[0];
    const body = request.body || {};
    const next = {
      name: body.name != null ? String(body.name).trim() : prev.name,
      account_user_id: body.accountUserId != null ? String(body.accountUserId).trim() || null : prev.account_user_id,
      driver_ids: Array.isArray(body.driverIds) ? body.driverIds.map(String) : prev.driver_ids || [],
      office_names: Array.isArray(body.officeNames) ? body.officeNames.map(String) : prev.office_names || [],
      work_office: body.workOffice != null ? String(body.workOffice).trim() || null : prev.work_office,
      position: body.position != null ? String(body.position).trim() || null : prev.position,
      invoice_number: body.invoiceNumber != null ? String(body.invoiceNumber).trim() || null : prev.invoice_number,
      vehicle_ownership: body.vehicleOwnership != null ? String(body.vehicleOwnership).trim() || null : prev.vehicle_ownership,
      cargo_insurance_status: body.cargoInsuranceStatus != null ? String(body.cargoInsuranceStatus).trim() || null : prev.cargo_insurance_status,
      active: body.active != null ? Boolean(body.active) : prev.active
    };
    const result = await pool.query(
      `update members set
        name=$1,
        account_user_id=$2,
        driver_ids=$3,
        office_names=$4,
        work_office=$5,
        position=$6,
        invoice_number=$7,
        vehicle_ownership=$8,
        cargo_insurance_status=$9,
        active=$10,
        updated_at=now()
      where id=$11
      returning *`,
      [
        next.name,
        next.account_user_id,
        next.driver_ids,
        next.office_names,
        next.work_office,
        next.position,
        next.invoice_number,
        next.vehicle_ownership,
        next.cargo_insurance_status,
        next.active,
        request.params.id
      ]
    );
    await writeAuditLog(request, 'update', 'member', String(request.params.id), {
      changedKeys: Object.keys(body || {})
    });
    return ok(result.rows[0]);
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send(fail('member_update_failed', 'Failed to update member.'));
  }
});

app.post('/api/v1/members/:id/deactivate', { preHandler: [authGuard, requireAdmin] }, async (request, reply) => {
  const reason = String(request.body?.reason || '').trim() || null;
  const result = await pool.query(
    `update members
      set active = false, inactive_reason = $1, inactive_at = now(), updated_at = now()
      where id = $2
      returning *`,
    [reason, request.params.id]
  );
  if (!result.rows[0]) return reply.code(404).send(fail('not_found', 'Member not found.'));
  await writeAuditLog(request, 'deactivate', 'member', String(request.params.id), { reason });
  return ok(result.rows[0]);
});

app.post('/api/v1/members/:id/activate', { preHandler: [authGuard, requireAdmin] }, async (request, reply) => {
  const result = await pool.query(
    `update members
      set active = true, inactive_reason = null, inactive_at = null, updated_at = now()
      where id = $1
      returning *`,
    [request.params.id]
  );
  if (!result.rows[0]) return reply.code(404).send(fail('not_found', 'Member not found.'));
  await writeAuditLog(request, 'activate', 'member', String(request.params.id));
  return ok(result.rows[0]);
});

app.get('/api/v1/payroll/entries', { preHandler: [authGuard, requireAdmin] }, async (request, reply) => {
  try {
    const month = normalizeMonth(request.query.month);
    const driverId = String(request.query.driverId || '').trim();
    const status = String(request.query.status || 'all').trim();
    const q = String(request.query.q || '').trim();
    const page = Math.max(1, Number(request.query.page || 1));
    const limit = Math.max(1, Math.min(500, Number(request.query.limit || 100)));
    const offset = (page - 1) * limit;

    const where = [];
    const values = [];
    if (month && month !== 'all') {
      values.push(month);
      where.push(`month = $${values.length}`);
    }
    if (driverId && driverId !== 'all') {
      values.push(driverId);
      where.push(`driver_id = $${values.length}`);
    }
    if (status && status !== 'all') {
      values.push(status);
      where.push(`status = $${values.length}`);
    }
    if (q) {
      values.push(`%${q}%`);
      where.push(`(content ilike $${values.length} or driver_id ilike $${values.length})`);
    }
    const whereSql = where.length > 0 ? `where ${where.join(' and ')}` : '';

    const countResult = await pool.query(`select count(*)::int as count from payroll_entries ${whereSql}`, values);
    values.push(limit, offset);
    const result = await pool.query(
      `select * from payroll_entries ${whereSql}
      order by month desc, driver_id asc, coalesce(row_no, 99999) asc, content asc
      limit $${values.length - 1} offset $${values.length}`,
      values
    );
    return ok({
      items: result.rows,
      page,
      limit,
      total: countResult.rows[0]?.count || 0
    });
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send(fail('payroll_list_failed', 'Failed to fetch payroll entries.'));
  }
});

app.get('/api/v1/payroll/summary', { preHandler: [authGuard, requireAdmin] }, async (request, reply) => {
  try {
    const month = normalizeMonth(request.query.month);
    const driverId = String(request.query.driverId || '').trim();
    const where = [];
    const values = [];
    if (month && month !== 'all') {
      values.push(month);
      where.push(`month = $${values.length}`);
    }
    if (driverId && driverId !== 'all') {
      values.push(driverId);
      where.push(`driver_id = $${values.length}`);
    }
    const whereSql = where.length > 0 ? `where ${where.join(' and ')}` : '';
    const summary = await pool.query(
      `select
        count(*)::int as count,
        coalesce(sum(total), 0)::numeric as total_amount,
        count(*) filter (where status = 'pending')::int as pending_count,
        count(*) filter (where status = 'needs_change')::int as needs_change_count
      from payroll_entries ${whereSql}`,
      values
    );
    return ok(summary.rows[0] || {
      count: 0,
      total_amount: 0,
      pending_count: 0,
      needs_change_count: 0
    });
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send(fail('payroll_summary_failed', 'Failed to fetch payroll summary.'));
  }
});

app.post('/api/v1/payroll/entries', { preHandler: [authGuard, requireAdmin] }, async (request, reply) => {
  try {
    const body = request.body || {};
    const driverId = String(body.driverId || '').trim();
    const month = normalizeMonth(body.month);
    const content = String(body.content || '').trim();
    if (!driverId || !month || !content) {
      return reply.code(400).send(fail('invalid_request', 'driverId, month, content are required.'));
    }
    const unitPrice = parseNumeric(body.unitPrice);
    const quantity = parseNumeric(body.quantity);
    const total = body.total != null && body.total !== ''
      ? parseNumeric(body.total)
      : unitPrice * quantity;
    const id = String(body.id || `${driverId}-${month}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`);
    const statementId = String(body.statementId || 'default');
    const statementType = String(body.statementType || 'driver');
    const rowNo = body.rowNo != null ? Number(body.rowNo) : null;

    const result = await pool.query(
      `insert into payroll_entries
        (id, driver_id, month, content, unit_price, quantity, total, status, statement_id, statement_type, row_no, input_source, updated_at)
        values ($1,$2,$3,$4,$5,$6,$7,'pending',$8,$9,$10,'manual',now())
        returning *`,
      [id, driverId, month, content, unitPrice, quantity, total, statementId, statementType, rowNo]
    );
    await writeAuditLog(request, 'create', 'payroll-entry', id, { driverId, month, content });
    return reply.code(201).send(ok(result.rows[0]));
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send(fail('payroll_create_failed', 'Failed to create payroll entry.'));
  }
});

app.patch('/api/v1/payroll/entries/:id', { preHandler: [authGuard, requireAdmin] }, async (request, reply) => {
  try {
    const current = await pool.query('select * from payroll_entries where id = $1 limit 1', [request.params.id]);
    if (!current.rows[0]) return reply.code(404).send(fail('not_found', 'Payroll entry not found.'));
    const prev = current.rows[0];
    const body = request.body || {};
    const next = {
      driver_id: body.driverId != null ? String(body.driverId).trim() || prev.driver_id : prev.driver_id,
      month: body.month != null ? normalizeMonth(body.month) || prev.month : prev.month,
      content: body.content != null ? String(body.content).trim() || prev.content : prev.content,
      unit_price: body.unitPrice != null ? parseNumeric(body.unitPrice) : Number(prev.unit_price || 0),
      quantity: body.quantity != null ? parseNumeric(body.quantity) : Number(prev.quantity || 0),
      total: body.total != null && body.total !== ''
        ? parseNumeric(body.total)
        : (
          (body.unitPrice != null ? parseNumeric(body.unitPrice) : Number(prev.unit_price || 0))
          * (body.quantity != null ? parseNumeric(body.quantity) : Number(prev.quantity || 0))
        ),
      status: body.status != null ? String(body.status).trim() || prev.status : prev.status,
      statement_id: body.statementId != null ? String(body.statementId).trim() || prev.statement_id : prev.statement_id,
      statement_type: body.statementType != null ? String(body.statementType).trim() || prev.statement_type : prev.statement_type,
      row_no: body.rowNo != null ? Number(body.rowNo) : prev.row_no
    };
    const result = await pool.query(
      `update payroll_entries set
        driver_id=$1,
        month=$2,
        content=$3,
        unit_price=$4,
        quantity=$5,
        total=$6,
        status=$7,
        statement_id=$8,
        statement_type=$9,
        row_no=$10,
        updated_at=now()
      where id=$11
      returning *`,
      [
        next.driver_id,
        next.month,
        next.content,
        next.unit_price,
        next.quantity,
        next.total,
        next.status,
        next.statement_id,
        next.statement_type,
        next.row_no,
        request.params.id
      ]
    );
    await writeAuditLog(request, 'update', 'payroll-entry', String(request.params.id), {
      changedKeys: Object.keys(body || {})
    });
    return ok(result.rows[0]);
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send(fail('payroll_update_failed', 'Failed to update payroll entry.'));
  }
});

app.delete('/api/v1/payroll/entries/:id', { preHandler: [authGuard, requireAdmin] }, async (request, reply) => {
  try {
    const result = await pool.query('delete from payroll_entries where id = $1 returning id, driver_id, month', [request.params.id]);
    if (!result.rows[0]) return reply.code(404).send(fail('not_found', 'Payroll entry not found.'));
    await writeAuditLog(request, 'delete', 'payroll-entry', String(request.params.id), result.rows[0]);
    return ok(result.rows[0]);
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send(fail('payroll_delete_failed', 'Failed to delete payroll entry.'));
  }
});

app.post('/api/v1/payroll/import/details', { preHandler: [authGuard, requireAdmin] }, async (request, reply) => {
  const rows = Array.isArray(request.body?.rows) ? request.body.rows : [];
  const replaceCsvForMonths = Boolean(request.body?.replaceCsvForMonths);
  if (rows.length === 0) return reply.code(400).send(fail('invalid_request', 'rows is required.'));

  const normalizedRows = rows
    .map((row) => {
      const driverId = String(row?.driverId || '').trim();
      const month = normalizeMonth(row?.month);
      if (!driverId || !month) return null;
      const unitPrice = parseNumeric(row?.unitPrice);
      const quantity = parseNumeric(row?.quantity);
      const basePay = parseNumeric(row?.basePay);
      const allowance = parseNumeric(row?.allowance);
      const deduction = parseNumeric(row?.deduction);
      const total = row?.total != null && row?.total !== ''
        ? parseNumeric(row?.total)
        : unitPrice * quantity || (basePay + allowance - deduction);
      return {
        id: String(row?.id || `${driverId}-${month}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`),
        driverId,
        month,
        content: String(row?.content || row?.description || '').trim(),
        unitPrice,
        quantity,
        total,
        statementId: String(row?.statementId || 'default'),
        statementType: String(row?.statementType || 'driver'),
        rowNo: row?.rowNo != null ? Number(row.rowNo) : null,
        inputSource: String(row?.inputSource || 'csv')
      };
    })
    .filter(Boolean);

  const client = await pool.connect();
  try {
    await client.query('begin');
    if (replaceCsvForMonths) {
      const months = [...new Set(normalizedRows.map(row => row.month))];
      if (months.length > 0) {
        await client.query('delete from payroll_entries where month = any($1::text[]) and input_source = $2', [months, 'csv']);
      }
    }
    for (const row of normalizedRows) {
      await client.query(
        `insert into payroll_entries
          (id, driver_id, month, content, unit_price, quantity, total, status, statement_id, statement_type, row_no, input_source, updated_at)
        values ($1,$2,$3,$4,$5,$6,$7,'pending',$8,$9,$10,$11,now())
        on conflict (id) do update set
          driver_id=excluded.driver_id,
          month=excluded.month,
          content=excluded.content,
          unit_price=excluded.unit_price,
          quantity=excluded.quantity,
          total=excluded.total,
          statement_id=excluded.statement_id,
          statement_type=excluded.statement_type,
          row_no=excluded.row_no,
          input_source=excluded.input_source,
          updated_at=now()`,
        [
          row.id,
          row.driverId,
          row.month,
          row.content,
          row.unitPrice,
          row.quantity,
          row.total,
          row.statementId,
          row.statementType,
          row.rowNo,
          row.inputSource
        ]
      );
    }
    await client.query('commit');
    await writeAuditLog(request, 'import', 'payroll-entry', 'bulk', {
      importedCount: normalizedRows.length,
      replaceCsvForMonths
    });
    return ok({ importedCount: normalizedRows.length });
  } catch (error) {
    await client.query('rollback');
    request.log.error(error);
    return reply.code(500).send(fail('payroll_import_failed', 'Failed to import payroll details.'));
  } finally {
    client.release();
  }
});

app.post('/api/v1/payroll/import/sales-summary', { preHandler: [authGuard, requireAdmin] }, async (request, reply) => {
  const rows = Array.isArray(request.body?.rows) ? request.body.rows : [];
  if (rows.length === 0) return reply.code(400).send(fail('invalid_request', 'rows is required.'));

  const map = new Map();
  for (const row of rows) {
    const month = normalizeMonth(row?.month);
    if (!month) continue;
    const total = parseNumeric(row?.total != null ? row.total : row?.basePay);
    map.set(month, (map.get(month) || 0) + total);
  }

  const client = await pool.connect();
  try {
    await client.query('begin');
    for (const [month, total] of map.entries()) {
      await client.query(
        `insert into payroll_sales_summaries (month, total, updated_at)
          values ($1, $2, now())
          on conflict (month) do update set total = excluded.total, updated_at = now()`,
        [month, total]
      );
    }
    await client.query('commit');
    await writeAuditLog(request, 'import', 'payroll-sales-summary', 'bulk', {
      importedCount: map.size
    });
    return ok({ importedCount: map.size });
  } catch (error) {
    await client.query('rollback');
    request.log.error(error);
    return reply.code(500).send(fail('sales_import_failed', 'Failed to import sales summary.'));
  } finally {
    client.release();
  }
});

app.get('/api/v1/payroll/sales-summary', { preHandler: [authGuard, requireAdmin] }, async (request, reply) => {
  try {
    const month = normalizeMonth(request.query.month);
    if (month && month !== 'all') {
      const one = await pool.query('select month, total, updated_at from payroll_sales_summaries where month = $1 limit 1', [month]);
      return ok({ items: one.rows, total: one.rows[0]?.total || 0 });
    }
    const list = await pool.query(
      'select month, total, updated_at from payroll_sales_summaries order by month desc limit 24'
    );
    const total = list.rows.reduce((sum, row) => sum + Number(row.total || 0), 0);
    return ok({ items: list.rows, total });
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send(fail('sales_summary_list_failed', 'Failed to fetch sales summary.'));
  }
});

app.get('/api/v1/payroll/deductions', { preHandler: [authGuard, requireAdmin] }, async (request, reply) => {
  const driverId = String(request.query.driverId || '').trim();
  const month = normalizeMonth(request.query.month);
  const statementId = String(request.query.statementId || 'default');
  if (!driverId || !month) {
    return reply.code(400).send(fail('invalid_request', 'driverId and month are required.'));
  }
  const result = await pool.query(
    'select * from payroll_deductions where driver_id = $1 and month = $2 and statement_id = $3 limit 1',
    [driverId, month, statementId]
  );
  return ok(result.rows[0] || {
    driver_id: driverId,
    month,
    statement_id: statementId,
    items: [],
    tax_settings: { mode: 'none', rate: 10 }
  });
});

app.put('/api/v1/payroll/deductions', { preHandler: [authGuard, requireAdmin] }, async (request, reply) => {
  const driverId = String(request.body?.driverId || '').trim();
  const month = normalizeMonth(request.body?.month);
  const statementId = String(request.body?.statementId || 'default');
  const items = Array.isArray(request.body?.items) ? request.body.items : [];
  const taxSettings = request.body?.taxSettings && typeof request.body.taxSettings === 'object'
    ? request.body.taxSettings
    : { mode: 'none', rate: 10 };

  if (!driverId || !month) {
    return reply.code(400).send(fail('invalid_request', 'driverId and month are required.'));
  }
  const result = await pool.query(
    `insert into payroll_deductions (driver_id, month, statement_id, items, tax_settings, updated_at)
      values ($1,$2,$3,$4,$5,now())
      on conflict (driver_id, month, statement_id) do update set
      items = excluded.items,
      tax_settings = excluded.tax_settings,
      updated_at = now()
      returning *`,
    [driverId, month, statementId, JSON.stringify(items), JSON.stringify(taxSettings)]
  );
  await writeAuditLog(request, 'update', 'payroll-deductions', `${driverId}:${month}:${statementId}`, {
    itemCount: items.length,
    taxSettings
  });
  return ok(result.rows[0]);
});

await initDb();

const port = Number(process.env.PORT || 8080);
const host = process.env.HOST || '0.0.0.0';
app.listen({ port, host });
