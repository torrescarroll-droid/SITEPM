/** Destructive test fixtures are confined to the dedicated loopback SITEPM database. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { randomUUID } from 'node:crypto';
import postgres from 'postgres';
import { createClient } from '@supabase/supabase-js';
const env = parseEnv(readFileSync('.env.isolated.local', 'utf8'));
const api = new URL(env.API_URL);
const db = new URL(env.DB_URL);
assert(['127.0.0.1','localhost'].includes(api.hostname) && api.port === '55431', 'Isolated API only');
assert(['127.0.0.1','localhost'].includes(db.hostname) && db.port === '55432', 'Isolated DB only');
const sql = postgres(env.DB_URL, { max: 3 });
const password = 'Local-only-SITEPM-test-2026!';
const run = randomUUID();
async function account(label) {
  const client = createClient(env.API_URL, env.ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const signed = await client.auth.signUp({email:`sprint3-${label}-${run}@example.test`,password,options:{data:{company_name:`Isolated SITEPM ${label}`,full_name:`Tester ${label}`}}});
  assert.ifError(signed.error); assert(signed.data.session);
  const profile = await client.from('profiles').select('id,company_id').single(); assert.ifError(profile.error);
  const project = await client.from('projects').insert({company_id:profile.data.company_id,name:`Field reliability ${label}`}).select('id').single(); assert.ifError(project.error);
  return {client,company:profile.data.company_id,project:project.data.id,user:signed.data.user.id};
}
const report = {log_date:'2026-10-07',issue_flag:false,work_performed:'Framed east wall',notes:null,deliveries:null,delays:null};
const crew = {companyName:'Test framing',tradeName:'Carpentry',workerCount:3};
const call = (a, more={}) => a.client.rpc('save_field_report',{p_request_id:randomUUID(),p_project_id:a.project,p_report_id:null,p_expected_revision:null,p_report:report,p_crews:[crew],p_follow_up:'Inspect framing',...more});
try {
  const [a,b] = await Promise.all([account('a'),account('b')]);
  const request=randomUUID();
  const first=await call(a,{p_request_id:request});assert.ifError(first.error);const id=first.data[0].report_id;
  assert.equal(first.data[0].revision,1);
  assert.equal((await a.client.from('field_log_crews').select('worker_count').eq('field_log_id',id)).data[0].worker_count,3);
  assert.equal((await a.client.from('tasks').select('id').eq('source_field_log_id',id)).data.length,1);
  const replay=await call(a,{p_request_id:request});assert.ifError(replay.error);assert(replay.data[0].replayed);assert.equal(replay.data[0].report_id,id);
  const changed=await call(a,{p_request_id:request,p_report:{...report,work_performed:'Changed'}});assert(changed.error);
  const concurrentKey=randomUUID();const concurrent=await Promise.all([call(a,{p_request_id:concurrentKey}),call(a,{p_request_id:concurrentKey})]);
  concurrent.forEach(r=>assert.ifError(r.error));assert.equal(concurrent[0].data[0].report_id,concurrent[1].data[0].report_id);
  const photoId=randomUUID();assert.ifError((await a.client.from('photos').insert({id:photoId,company_id:a.company,project_id:a.project,field_log_id:id,storage_path:`${a.company}/${a.project}/${photoId}/photo.jpg`,content_type:'image/jpeg',byte_size:100})).error);
  const editArgs={p_report_id:id,p_expected_revision:1,p_follow_up:null,p_report:{...report,work_performed:'Framed and inspected'},p_crews:[{...crew,workerCount:5}]};
  const editKey=randomUUID();const edited=await call(a,{...editArgs,p_request_id:editKey});assert.ifError(edited.error);assert.equal(edited.data[0].revision,2);
  assert.equal((await a.client.from('field_log_crews').select('worker_count').eq('field_log_id',id)).data[0].worker_count,5);
  assert((await call(a,editArgs)).error,'Stale revision must fail');
  assert.ifError((await call(a,{...editArgs,p_request_id:editKey})).error,'Update retry must replay despite old revision');
  assert.equal((await a.client.from('photos').select('field_log_id').eq('id',photoId).single()).data.field_log_id,id);
  assert.equal((await a.client.from('tasks').select('source_field_log_id').eq('source_field_log_id',id)).data.length,1);
  console.log('PASS create/update report + crew + linked task; duplicate and concurrent retries; stale edit rejected');
  const before=await sql`select count(*)::int n from public.field_logs where company_id=${a.company}`;
  for (const bad of [{p_report:{...report,log_date:'2026-02-30'}},{p_crews:[{...crew,workerCount:-1}]},{p_crews:[{...crew,tradeName:''}]},{p_report:{...report,work_performed:'',notes:''}}]) assert((await call(a,bad)).error);
  assert.equal((await sql`select count(*)::int n from public.field_logs where company_id=${a.company}`)[0].n,before[0].n);
  // Failure occurs after report mutation and crew deletion. PostgreSQL must roll all of it back.
  await sql.unsafe(`create or replace function public.isolated_reject_crew() returns trigger language plpgsql as $$ begin if new.trade_name='__reject__' then raise exception 'Isolated crew failure'; end if; return new; end $$;
    create trigger isolated_reject_crew before insert on public.field_log_crews for each row execute function public.isolated_reject_crew();
    create or replace function public.isolated_reject_task() returns trigger language plpgsql as $$ begin if new.title='__reject__' then raise exception 'Isolated task failure'; end if; return new; end $$;
    create trigger isolated_reject_task before insert on public.tasks for each row execute function public.isolated_reject_task();`);
  assert((await call(a,{p_crews:[crew,{...crew,tradeName:'__reject__'}]})).error);
  assert((await call(a,{p_follow_up:'__reject__'})).error);
  assert((await call(a,{...editArgs,p_expected_revision:2,p_crews:[{...crew,tradeName:'__reject__'}]})).error);
  const preserved=await a.client.from('field_logs').select('work_performed,revision').eq('id',id).single();assert.equal(preserved.data.revision,2);assert.equal(preserved.data.work_performed,'Framed and inspected');
  assert.equal((await a.client.from('field_log_crews').select('worker_count').eq('field_log_id',id)).data[0].worker_count,5);
  assert.equal((await sql`select count(*)::int n from public.field_logs where company_id=${a.company}`)[0].n,before[0].n);
  // Failed operation has no receipt and can be corrected with the same request key.
  const retryKey=randomUUID();assert((await call(a,{p_request_id:retryKey,p_crews:[{...crew,tradeName:'__reject__'}]})).error);assert.ifError((await call(a,{p_request_id:retryKey})).error);
  console.log('PASS invalid writes; create/update rollback after related-write failure; prior crews retained; corrected retry');
  assert((await call(b,{p_project_id:a.project})).error);
  assert((await call(b,{p_report_id:id,p_expected_revision:2,p_follow_up:null})).error);
  for (const table of ['field_logs','field_log_crews','field_report_saves','tasks']) {
    const rows=await b.client.from(table).select('company_id').eq('company_id',a.company);assert.ifError(rows.error);assert.equal(rows.data.length,0);
  }
  const forged=await b.client.from('field_report_saves').insert({company_id:a.company,request_id:randomUUID(),actor_id:b.user,report_id:id,project_id:a.project,revision:1,payload:{}});assert(forged.error);
  const anonymous=createClient(env.API_URL,env.ANON_KEY,{auth:{persistSession:false}});assert((await anonymous.rpc('save_field_report',{p_request_id:randomUUID(),p_project_id:a.project,p_report_id:null,p_expected_revision:null,p_report:report,p_crews:[]})).error);
  console.log('PASS Company A/B read/write isolation, forged receipt denied, anonymous save denied');
  const competing=await Promise.all([call(a,{...editArgs,p_expected_revision:2,p_report:{...report,work_performed:'Editor one'}}),call(a,{...editArgs,p_expected_revision:2,p_report:{...report,work_performed:'Editor two'}})]);
  assert.equal(competing.filter(result=>!result.error).length,1);assert.equal(competing.filter(result=>result.error?.code==='40001').length,1);
  assert.ifError((await call(a,{p_request_id:request})).error);
  assert.equal((await a.client.from('field_logs').select('revision').eq('id',id).single()).data.revision,3,'Old create replay must not revert newer report');
  console.log('PASS simultaneous editors: one commits, one conflicts; late retry cannot revert newer data');
  await Promise.all([a.client.auth.signOut(),b.client.auth.signOut()]);
  console.log('Isolated live Supabase database-write acceptance PASSED. Synthetic local fixtures retained for inspection.');
} finally {
  await sql.unsafe('drop trigger if exists isolated_reject_crew on public.field_log_crews; drop function if exists public.isolated_reject_crew(); drop trigger if exists isolated_reject_task on public.tasks; drop function if exists public.isolated_reject_task();');
  await sql.end();
}
