/** Authenticated receipt attack/acceptance. Only guarded synthetic loopback fixtures. */
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import postgres from 'postgres';
import {createClient} from '@supabase/supabase-js';
import {isolatedEnvironment} from './field-receipt-environment.mjs';
const e=isolatedEnvironment(),sql=postgres(e.DB_URL,{max:3,onnotice:()=>{}});
const vulnerable=process.argv.includes('--expect-vulnerable'),run=randomUUID();
const report={log_date:'2026-10-09',issue_flag:false,work_performed:'Persisted synthetic report'};
async function account(label){
 const client=createClient(e.API_URL,e.ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
 const r=await client.auth.signUp({email:`receipt-${label}-${run}@example.test`,password:'Local-only-SITEPM-test-2026!',options:{data:{company_name:`Isolated receipt ${label}`,full_name:`Receipt tester ${label}`}}});assert.ifError(r.error);assert(r.data.session);
 const p=await client.from('profiles').select('id,company_id').single();assert.ifError(p.error);
 const j=await client.from('projects').insert({company_id:p.data.company_id,name:'Isolated receipt integrity'}).select('id').single();assert.ifError(j.error);
 return {client,company:p.data.company_id,project:j.data.id,user:r.data.user.id};
}
const args=(a,extra={})=>({p_request_id:randomUUID(),p_project_id:a.project,p_report_id:null,p_expected_revision:null,p_report:report,p_crews:[{tradeName:'Carpentry',companyName:'Synthetic crew',workerCount:2}],p_follow_up:null,...extra});
try{
 const [a,b]=await Promise.all([account('a'),account('b')]);
 const firstArgs=args(a),first=await a.client.rpc('save_field_report',firstArgs);assert.ifError(first.error);const id=first.data[0].report_id;
 const attack=args(a,{p_report_id:id,p_expected_revision:1,p_report:{...report,work_performed:'FORGED — NEVER PERSISTED'},p_crews:[]});
 const forged={company_id:a.company,request_id:attack.p_request_id,actor_id:a.user,report_id:id,project_id:a.project,revision:77,payload:{project:a.project,report_id:id,expected_revision:1,report:attack.p_report,crews:[],follow_up:null}};
 const inserted=await a.client.from('field_report_saves').insert(forged);
 if(vulnerable){
  assert.ifError(inserted.error);const result=await a.client.rpc('save_field_report',attack);assert.ifError(result.error);assert.equal(result.data[0].revision,77);assert(result.data[0].replayed);
  const actual=await a.client.from('field_logs').select('work_performed,revision').eq('id',id).single();assert.ifError(actual.error);assert.equal(actual.data.work_performed,report.work_performed);assert.equal(actual.data.revision,1);
  console.log('CONFIRMED BEFORE: authenticated own-company forged receipt returns replayed success/revision 77 without persisting report payload.');
 }else{
  assert(inserted.error,'Own-company forged receipt must be denied');
  assert((await a.client.from('field_report_saves').insert({...forged,trusted:true})).error,'Client cannot set trusted marker');
  assert((await a.client.from('field_report_saves').update({trusted:true,payload:{}}).eq('request_id',firstArgs.p_request_id)).error,'Client cannot rewrite receipt');
  assert((await a.client.from('field_report_saves').delete().eq('request_id',firstArgs.p_request_id)).error,'Client cannot erase receipt');
  await assert.rejects(sql.begin(async tx=>{
   await tx.unsafe('set local role authenticated');
   await tx`select set_config('request.jwt.claim.sub',${a.user},true)`;
   await tx`insert into public.field_report_saves(company_id,request_id,actor_id,report_id,project_id,revision,payload,trusted) values(${a.company},${randomUUID()},${a.user},${id},${a.project},1,'{}',true)`;
  }),e=>e.code==='42501','Direct SQL receipt forgery must also fail');
  const saved=await a.client.rpc('save_field_report',attack);assert.ifError(saved.error);assert(!saved.data[0].replayed);assert.equal(saved.data[0].revision,2);
  const actual=await a.client.from('field_logs').select('work_performed').eq('id',id).single();assert.equal(actual.data.work_performed,attack.p_report.work_performed);
  for(const role of ['authenticated','anon','service_role']){
   for(const privilege of ['INSERT','UPDATE','DELETE'])assert(!(await sql`select has_table_privilege(${role},'public.field_report_saves',${privilege}) allowed`)[0].allowed,`${role} ${privilege}`);
   for(const privilege of ['INSERT','UPDATE'])assert.equal((await sql`select count(*)::int n from pg_attribute where attrelid='public.field_report_saves'::regclass and attnum>0 and not attisdropped and has_column_privilege(${role},attrelid,attnum,${privilege})`)[0].n,0,'No residual column DML grants');
   assert(!(await sql`select has_schema_privilege(${role},'sitepm_field_internal','USAGE') allowed`)[0].allowed);
   assert(!(await sql`select has_function_privilege(${role},'sitepm_field_internal.actor_id()','EXECUTE') allowed`)[0].allowed);
  }
  const functionRow=(await sql`select p.prosecdef,p.proconfig,r.rolname,r.rolcanlogin,r.rolbypassrls,r.rolsuper from pg_proc p join pg_roles r on r.oid=p.proowner where p.oid='public.save_field_report(uuid,uuid,uuid,integer,jsonb,jsonb,text)'::regprocedure`)[0];assert(functionRow.prosecdef);assert.equal(functionRow.rolname,'sitepm_field_writer');assert(!functionRow.rolcanlogin&&!functionRow.rolbypassrls&&!functionRow.rolsuper);
  const attributes=(await sql`select rolinherit,rolcreatedb,rolcreaterole,rolreplication from pg_roles where rolname='sitepm_field_writer'`)[0];assert(Object.values(attributes).every(v=>v===false));
  assert(!(await sql`select has_table_privilege('sitepm_field_writer','public.documents','INSERT') allowed`)[0].allowed);assert(functionRow.proconfig.includes('row_security=on'));assert(functionRow.proconfig.some(v=>v==='search_path=""'));
  assert.equal((await sql`select count(*)::int n from pg_class c join pg_roles r on r.oid=c.relowner where r.rolname='sitepm_field_writer'`)[0].n,0);
  for(const role of ['authenticated','anon','service_role','authenticator'])assert(!(await sql`select pg_has_role(${role},'sitepm_field_writer','MEMBER') allowed`)[0].allowed);
  assert(!(await sql`select has_schema_privilege('sitepm_field_writer','public','CREATE') allowed`)[0].allowed);
  assert(!(await sql`select has_function_privilege('anon','public.save_field_report(uuid,uuid,uuid,integer,jsonb,jsonb,text)','EXECUTE') allowed`)[0].allowed);
  // Existing untrusted rows cannot claim successful writes, even with matching payload.
  const legacy=args(a);await sql`insert into public.field_report_saves(company_id,request_id,actor_id,report_id,project_id,revision,payload) values(${a.company},${legacy.p_request_id},${a.user},${id},${a.project},1,${sql.json({project:a.project,report_id:null,expected_revision:null,report:legacy.p_report,crews:legacy.p_crews,follow_up:null})})`;
  assert((await a.client.rpc('save_field_report',legacy)).error,'Legacy untrusted receipt must not replay');
  const repeat=await a.client.rpc('save_field_report',firstArgs);assert.ifError(repeat.error);assert(repeat.data[0].replayed);assert.equal(repeat.data[0].report_id,id);
  const shared=args(a);const concurrent=await Promise.all([a.client.rpc('save_field_report',shared),a.client.rpc('save_field_report',shared)]);concurrent.forEach(r=>assert.ifError(r.error));assert.equal(concurrent[0].data[0].report_id,concurrent[1].data[0].report_id);
  assert.equal((await sql`select count(*)::int n from public.field_report_saves where company_id=${a.company} and request_id=${shared.p_request_id}`)[0].n,1);
  const foreign=await b.client.from('field_report_saves').select('*').eq('company_id',a.company);assert.ifError(foreign.error);assert.equal(foreign.data.length,0);
  assert((await b.client.rpc('save_field_report',{...attack,p_request_id:randomUUID()})).error);
  assert((await b.client.from('field_report_saves').insert({...forged,request_id:randomUUID(),actor_id:b.user})).error);
  // Interruption before COMMIT rolls back both report and receipt; same key can retry.
  const rolledBack=args(a),countBefore=(await sql`select count(*)::int n from public.field_logs where company_id=${a.company}`)[0].n;
  await assert.rejects(sql.begin(async tx=>{
   await tx.unsafe('set local role authenticated');
   await tx`select set_config('request.jwt.claim.sub',${a.user},true)`;
   await tx`select * from public.save_field_report(${rolledBack.p_request_id}::uuid,${a.project}::uuid,null,null,${sql.json(report)}::jsonb,${sql.json(rolledBack.p_crews)}::jsonb,null)`;
   throw Error('Synthetic interruption before commit');
  }),/Synthetic interruption/);
  assert.equal((await sql`select count(*)::int n from public.field_logs where company_id=${a.company}`)[0].n,countBefore);
  assert.equal((await sql`select count(*)::int n from public.field_report_saves where request_id=${rolledBack.p_request_id}`)[0].n,0);
  assert.ifError((await a.client.rpc('save_field_report',rolledBack)).error);
  // A committed transaction whose response is discarded remains safely retryable.
  const interrupted=args(a);assert.ifError((await a.client.rpc('save_field_report',interrupted)).error);const recovered=await a.client.rpc('save_field_report',interrupted);assert.ifError(recovered.error);assert(recovered.data[0].replayed);
  console.log('PASS AFTER: same-tenant forgery/false success denied; persisted save; legacy receipt rejected; exact/concurrent/lost-response retries; A/B isolation; narrow owner/ACL checks.');
 }
 await Promise.all([a.client.auth.signOut(),b.client.auth.signOut()]);
}finally{await sql.end();}
