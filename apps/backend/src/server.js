import dotenv from 'dotenv';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import pg from 'pg';

dotenv.config();

const app = Fastify({ logger: true });
await app.register(cors, {
  origin: process.env.CORS_ORIGIN || true
});

const pool = new pg.Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD
});

app.get('/health', async () => ({ ok: true }));

app.get('/health/db', async (request, reply) => {
  try {
    const result = await pool.query('select now() as now');
    return { ok: true, now: result.rows[0]?.now };
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ ok: false });
  }
});

const port = Number(process.env.PORT || 8080);
const host = process.env.HOST || '0.0.0.0';

app.listen({ port, host });

