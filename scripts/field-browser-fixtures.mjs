/** Fault injection and inspection only on the dedicated local SITEPM database. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import postgres from 'postgres';
const env=parseEnv(readFileSync('.env.isolated.local','utf8'));
const db=new URL(env.DB_URL);assert(['127.0.0.1','localhost'].includes(db.hostname)&&db.port==='55432');
const sql=postgres(env.DB_URL,{max:1});
try {
 const mode=process.argv[2];
 if(mode==='on') await sql.unsafe(`create or replace function public.isolated_browser_crew() returns trigger language plpgsql set search_path = '' as $$ begin if new.trade_name='BROWSER_REJECT' then raise exception using errcode='22023',message='Synthetic browser rejection'; end if; if new.trade_name='BROWSER_SLOW' then perform pg_catalog.pg_sleep(5); end if; return new; end $$; create trigger isolated_browser_crew before insert on public.field_log_crews for each row execute function public.isolated_browser_crew();`);
 else if(mode==='off') await sql.unsafe('drop trigger if exists isolated_browser_crew on public.field_log_crews; drop function if exists public.isolated_browser_crew();');
 else if(mode==='stale') {
  const rows=await sql`update public.field_logs set work_performed='Readiness concurrent editor saved' where id=${process.argv[3]} and company_id=(select company_id from public.profiles where email='browser-a@sitepm.test') returning revision`;
  assert.equal(rows.length,1); console.log(JSON.stringify(rows));
 }
 else if(mode==='inspect') {
  const rows=await sql`select f.id,f.project_id,f.work_performed,f.revision,(select jsonb_agg(jsonb_build_object('trade',c.trade_name,'count',c.worker_count)) from public.field_log_crews c where c.field_log_id=f.id) crews,(select count(*)::int from public.tasks t where t.source_field_log_id=f.id) tasks,(select count(*)::int from public.field_report_saves s where s.report_id=f.id) receipts from public.field_logs f join public.profiles p on p.id=f.created_by where p.email='browser-a@sitepm.test' order by f.created_at`;
  console.log(JSON.stringify(rows));
 } else throw Error('Use on, off, stale <synthetic report UUID> or inspect');
} finally {await sql.end();}
