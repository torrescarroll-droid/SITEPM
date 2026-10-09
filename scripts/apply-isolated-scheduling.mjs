/** Install scheduling only after the NEW local stack's managed Auth schema has initialized. */
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import postgres from 'postgres';
import {isolatedEnvironment} from './isolated-environment.mjs';
const env=isolatedEnvironment();
assert(new URL(env.DB_URL).port==='55442','Only the separate clean replay stack is supported');
const sql=postgres(env.DB_URL,{max:1});
try {
  assert((await sql`select count(*)::integer as count from auth.schema_migrations`)[0].count>0,'Managed Auth must be initialized first');
  assert.equal((await sql`select to_regclass('public.schedule_resources') as existing`)[0].existing,null,'Preserve existing scheduling schema; do not replay twice');
  for(const file of readdirSync('supabase/migrations').filter(f=>/construction_scheduling|scheduling_integrity_boundary/.test(f)).sort()) {
    const source=readFileSync(`supabase/migrations/${file}`,'utf8');
    await sql.unsafe(source);
    const [version,...parts]=file.replace('.sql','').split('_');
    await sql`insert into supabase_migrations.schema_migrations(version,name,statements) values(${version},${parts.join('_')},${[source]})`;
    console.log(`PASS clean local migration ${file}`);
  }
}finally{await sql.end();}
