import fs from 'node:fs/promises';
import path from 'node:path';
import dotenv from 'dotenv';
import pg from 'pg';

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

const isSslEnabled = () => {
  const explicit = String(process.env.DB_SSL || '').toLowerCase();
  if (explicit === 'true' || explicit === '1') return true;
  if (explicit === 'false' || explicit === '0') return false;
  return String(process.env.DB_HOST || '').includes('supabase.co');
};

const readJsonLength = async (filePath) => {
  if (!filePath) return null;
  const abs = path.resolve(process.cwd(), filePath);
  const content = await fs.readFile(abs, 'utf8');
  const parsed = JSON.parse(content);
  return Array.isArray(parsed) ? parsed.length : 0;
};

const main = async () => {
  const args = parseArgs();
  const expected = {
    members: await readJsonLength(args.members),
    payroll_entries: await readJsonLength(args.payroll),
    sales_months: await readJsonLength(args.sales)
  };

  const pool = new pg.Pool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 5432),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl: isSslEnabled() ? { rejectUnauthorized: false } : undefined
  });

  try {
    const [members, payrollEntries, salesMonths, payrollOrphans] = await Promise.all([
      pool.query('select count(*)::int as c from members'),
      pool.query('select count(*)::int as c from payroll_entries'),
      pool.query('select count(*)::int as c from payroll_sales_summaries'),
      pool.query(`
        select count(*)::int as c
        from payroll_entries p
        where not exists (
          select 1 from members m
          where p.driver_id = any(m.driver_ids)
        )
      `)
    ]);

    const actual = {
      members: members.rows[0]?.c || 0,
      payroll_entries: payrollEntries.rows[0]?.c || 0,
      sales_months: salesMonths.rows[0]?.c || 0,
      payroll_orphan_driver_ids: payrollOrphans.rows[0]?.c || 0
    };

    const checks = [];
    if (expected.members != null) {
      checks.push({
        key: 'members',
        expected: expected.members,
        actual: actual.members,
        ok: expected.members === actual.members
      });
    }
    if (expected.payroll_entries != null) {
      checks.push({
        key: 'payroll_entries',
        expected: expected.payroll_entries,
        actual: actual.payroll_entries,
        ok: expected.payroll_entries === actual.payroll_entries
      });
    }
    if (expected.sales_months != null) {
      checks.push({
        key: 'sales_months',
        expected: expected.sales_months,
        actual: actual.sales_months,
        ok: expected.sales_months === actual.sales_months
      });
    }

    const result = {
      ok: checks.every((item) => item.ok),
      actual,
      expected,
      checks
    };
    console.log(JSON.stringify(result, null, 2));
    if (!result.ok) process.exitCode = 1;
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
};

main();
