import fs from 'node:fs/promises';
import path from 'node:path';
import dotenv from 'dotenv';
import pg from 'pg';
import { createDbPoolConfig } from '../src/db-config.js';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const parseArgs = () => {
  const args = process.argv.slice(2);
  const output = { members: '', payroll: '', sales: '' };
  for (let i = 0; i < args.length; i += 1) {
    const key = args[i];
    const value = args[i + 1];
    if (key === '--members') output.members = value || '';
    if (key === '--payroll') output.payroll = value || '';
    if (key === '--sales') output.sales = value || '';
  }
  return output;
};

const toArray = (value) => {
  if (Array.isArray(value)) return value.filter(Boolean).map((item) => String(item).trim()).filter(Boolean);
  if (!value) return [];
  return [String(value).trim()].filter(Boolean);
};

const normalizeMonth = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const digits = raw.replace(/[^\d]/g, '');
  if (digits.length >= 6) return `${digits.slice(0, 4)}-${digits.slice(4, 6)}`;
  return raw;
};

const parseNumeric = (value) => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const raw = String(value ?? '').trim();
  if (!raw) return 0;
  const normalized = raw.replace(/,/g, '').replace(/円/g, '').replace(/[^\d.-]/g, '');
  const num = Number(normalized);
  return Number.isFinite(num) ? num : 0;
};

const readJson = async (filePath) => {
  if (!filePath) return [];
  const abs = path.resolve(process.cwd(), filePath);
  const content = await fs.readFile(abs, 'utf8');
  const parsed = JSON.parse(content);
  if (Array.isArray(parsed)) return parsed;
  return [];
};

const mapLegacyMember = (member) => {
  const employmentStatus = String(member?.employmentStatus || '').toLowerCase();
  const retiredAt = member?.retiredAt ? String(member.retiredAt) : '';
  const isActive = !retiredAt && employmentStatus !== 'retired';
  return {
    name: String(member?.name || '').trim(),
    accountUserId: String(member?.accountUserId || member?.account_user_id || '').trim(),
    driverIds: toArray(member?.driverId || member?.driver_ids),
    officeNames: toArray(member?.officeName || member?.officeNames || member?.office_names),
    workOffice: String(member?.workOffice || member?.work_office || '').trim(),
    position: String(member?.position || '').trim(),
    invoiceNumber: String(member?.invoiceNumber || member?.invoice_number || '').trim(),
    vehicleOwnership: String(member?.vehicleOwnership || member?.vehicle_ownership || '').trim(),
    cargoInsuranceStatus: String(member?.cargoInsuranceStatus || member?.cargo_insurance_status || '').trim(),
    active: isActive,
    inactiveReason: String(member?.retirementReason || member?.inactive_reason || '').trim()
  };
};

const mapLegacyPayroll = (entry) => {
  const driverId = String(entry?.driverId || entry?.driver_id || '').trim();
  const month = normalizeMonth(entry?.month);
  const unitPrice = parseNumeric(entry?.unitPrice ?? entry?.unit_price);
  const quantity = parseNumeric(entry?.quantity);
  const total = entry?.total != null && entry?.total !== ''
    ? parseNumeric(entry.total)
    : unitPrice * quantity;
  return {
    id: String(entry?.id || `${driverId}-${month}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`),
    driverId,
    month,
    content: String(entry?.content || '').trim() || '業務委託費',
    unitPrice,
    quantity,
    total,
    status: String(entry?.status || 'pending').trim() || 'pending',
    statementId: String(entry?.statementId || entry?.statement_id || 'default'),
    statementType: String(entry?.statementType || entry?.statement_type || 'driver'),
    rowNo: entry?.rowNo != null ? Number(entry.rowNo) : (entry?.row_no != null ? Number(entry.row_no) : null),
    inputSource: String(entry?.inputSource || entry?.input_source || 'legacy'),
    driverNote: String(entry?.driverNote || entry?.driver_note || ''),
    adminNote: String(entry?.adminNote || entry?.admin_note || '')
  };
};

const mapLegacySales = (row) => ({
  month: normalizeMonth(row?.month),
  total: parseNumeric(row?.total ?? row?.basePay ?? row?.base_pay)
});

const upsertMembers = async (client, rows) => {
  let count = 0;
  for (const raw of rows) {
    const member = mapLegacyMember(raw);
    if (!member.name) continue;
    if (member.accountUserId) {
      await client.query(
        `insert into members
          (name, account_user_id, driver_ids, office_names, work_office, position, invoice_number, vehicle_ownership, cargo_insurance_status, active, inactive_reason, updated_at)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,now())
         on conflict (account_user_id) do update set
          name=excluded.name,
          driver_ids=excluded.driver_ids,
          office_names=excluded.office_names,
          work_office=excluded.work_office,
          position=excluded.position,
          invoice_number=excluded.invoice_number,
          vehicle_ownership=excluded.vehicle_ownership,
          cargo_insurance_status=excluded.cargo_insurance_status,
          active=excluded.active,
          inactive_reason=excluded.inactive_reason,
          updated_at=now()`,
        [
          member.name,
          member.accountUserId,
          member.driverIds,
          member.officeNames,
          member.workOffice || null,
          member.position || null,
          member.invoiceNumber || null,
          member.vehicleOwnership || null,
          member.cargoInsuranceStatus || null,
          member.active,
          member.inactiveReason || null
        ]
      );
    } else {
      await client.query(
        `insert into members
          (name, driver_ids, office_names, work_office, position, invoice_number, vehicle_ownership, cargo_insurance_status, active, inactive_reason, updated_at)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,now())`,
        [
          member.name,
          member.driverIds,
          member.officeNames,
          member.workOffice || null,
          member.position || null,
          member.invoiceNumber || null,
          member.vehicleOwnership || null,
          member.cargoInsuranceStatus || null,
          member.active,
          member.inactiveReason || null
        ]
      );
    }
    count += 1;
  }
  return count;
};

const upsertPayrollEntries = async (client, rows) => {
  let count = 0;
  for (const raw of rows) {
    const entry = mapLegacyPayroll(raw);
    if (!entry.driverId || !entry.month) continue;
    await client.query(
      `insert into payroll_entries
        (id, driver_id, month, content, unit_price, quantity, total, status, statement_id, statement_type, row_no, input_source, driver_note, admin_note, updated_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,now())
       on conflict (id) do update set
        driver_id=excluded.driver_id,
        month=excluded.month,
        content=excluded.content,
        unit_price=excluded.unit_price,
        quantity=excluded.quantity,
        total=excluded.total,
        status=excluded.status,
        statement_id=excluded.statement_id,
        statement_type=excluded.statement_type,
        row_no=excluded.row_no,
        input_source=excluded.input_source,
        driver_note=excluded.driver_note,
        admin_note=excluded.admin_note,
        updated_at=now()`,
      [
        entry.id,
        entry.driverId,
        entry.month,
        entry.content,
        entry.unitPrice,
        entry.quantity,
        entry.total,
        entry.status,
        entry.statementId,
        entry.statementType,
        entry.rowNo,
        entry.inputSource,
        entry.driverNote,
        entry.adminNote
      ]
    );
    count += 1;
  }
  return count;
};

const upsertSalesSummary = async (client, rows) => {
  const monthTotals = new Map();
  for (const raw of rows) {
    const row = mapLegacySales(raw);
    if (!row.month) continue;
    monthTotals.set(row.month, (monthTotals.get(row.month) || 0) + row.total);
  }
  for (const [month, total] of monthTotals.entries()) {
    await client.query(
      `insert into payroll_sales_summaries (month, total, updated_at)
       values ($1,$2,now())
       on conflict (month) do update set total=excluded.total, updated_at=now()`,
      [month, total]
    );
  }
  return monthTotals.size;
};

const main = async () => {
  const args = parseArgs();
  const members = await readJson(args.members);
  const payroll = await readJson(args.payroll);
  const sales = await readJson(args.sales);

  const pool = new pg.Pool(createDbPoolConfig());
  const client = await pool.connect();
  try {
    await client.query('begin');
    const memberCount = members.length > 0 ? await upsertMembers(client, members) : 0;
    const payrollCount = payroll.length > 0 ? await upsertPayrollEntries(client, payroll) : 0;
    const salesCount = sales.length > 0 ? await upsertSalesSummary(client, sales) : 0;
    await client.query('commit');
    console.log(`done: members=${memberCount}, payrollEntries=${payrollCount}, salesMonths=${salesCount}`);
  } catch (error) {
    await client.query('rollback');
    console.error(error);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
};

main();
