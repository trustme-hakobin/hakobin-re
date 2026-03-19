import path from 'node:path';
import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const isSslEnabled = () => {
  const explicit = String(process.env.DB_SSL || '').toLowerCase();
  if (explicit === 'true' || explicit === '1') return true;
  if (explicit === 'false' || explicit === '0') return false;
  return String(process.env.DB_HOST || '').includes('supabase.co');
};

const main = async () => {
  const ssl = isSslEnabled() ? { rejectUnauthorized: false } : undefined;
  const pool = new pg.Pool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 5432),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl
  });

  try {
    const result = await pool.query('select now() as now');
    console.log('DB OK', result.rows[0]?.now);
  } catch (error) {
    console.error('DB NG', error.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
};

main();
