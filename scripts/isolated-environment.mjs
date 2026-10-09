/** Local test environments only. Never accepts a hosted URL or an arbitrary database. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
export function isolatedEnvironment() {
  const env = parseEnv(readFileSync(process.env.SITEPM_ISOLATED_ENV ?? '.env.isolated.local', 'utf8'));
  const api = new URL(env.API_URL), db = new URL(env.DB_URL);
  const loopback = u => ['localhost','127.0.0.1'].includes(u.hostname);
  assert(loopback(api) && loopback(db) && api.protocol === 'http:' && ['postgres:','postgresql:'].includes(db.protocol), 'Local isolated endpoints required');
  assert([['55431','55432'],['55441','55442']].some(([a,d]) => api.port===a && db.port===d), 'Unknown isolated port pair');
  return env;
}
