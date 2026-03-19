export const isDbSslEnabled = () => {
  const explicit = String(process.env.DB_SSL || '').toLowerCase();
  if (explicit === 'true' || explicit === '1') return true;
  if (explicit === 'false' || explicit === '0') return false;
  return String(process.env.DB_HOST || '').includes('supabase.co');
};

export const createDbPoolConfig = () => ({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: isDbSslEnabled() ? { rejectUnauthorized: false } : undefined
});
