import { neon, NeonQueryFunction } from '@neondatabase/serverless';

let _sql: NeonQueryFunction<false, false> | null = null;

export function getDb(): NeonQueryFunction<false, false> | null {
  if (_sql) return _sql;

  const url = process.env.DATABASE_URL;

  if (!url || url === 'your-neon-connection-string-here') {
    return null;
  }

  _sql = neon(url);
  return _sql;
}
