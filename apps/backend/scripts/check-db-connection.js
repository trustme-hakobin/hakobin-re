import path from 'node:path';
import dotenv from 'dotenv';
import pg from 'pg';
import { createDbPoolConfig } from '../src/db-config.js';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const main = async () => {
  const pool = new pg.Pool(createDbPoolConfig());

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
