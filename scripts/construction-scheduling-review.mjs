import { isolatedEnvironment } from "./isolated-environment.mjs";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { createClient } from "@supabase/supabase-js";
const env = isolatedEnvironment();
const sql = postgres(env.DB_URL, { max: 3 });
const run = randomUUID();
async function account(label) {
  const client = createClient(env.API_URL, env.ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const signup = await client.auth.signUp({
    email: `schedule-${label}-${run}@example.test`,
    password: "Local-only-SITEPM-test-2026!",
    options: {
      data: {
        company_name: `Isolated schedule ${label}`,
        full_name: `Scheduler ${label}`,
      },
    },
  });
  assert.ifError(signup.error);
  const profile = await client.from("profiles").select("company_id").single();
  assert.ifError(profile.error);
  const project = await client
    .from("projects")
    .insert({
      company_id: profile.data.company_id,
      name: `Isolated schedule job ${label}`,
    })
    .select("id")
    .single();
  assert.ifError(project.error);
  return {
    client,
    company: profile.data.company_id,
    project: project.data.id,
    user: signup.data.user.id,
  };
}
const save = (a, kind, record, key = randomUUID()) =>
  a.client.rpc("save_construction_schedule", {
    p_request_id: key,
    p_kind: kind,
    p_record: record,
  });
const resource = (name, type = "crew") => ({
  id: randomUUID(),
  name,
  resource_type: type,
  active: true,
  company_name: "",
  trade_name: "Electrical",
  email: "",
  phone: "",
  notes: "",
});
const activity = (a, more = {}) => ({
  id: randomUUID(),
  project_id: a.project,
  name: "Isolated rough-in",
  start_date: "2026-10-08",
  finish_date: "2026-10-08",
  all_day: false,
  start_time: "07:00",
  finish_time: "15:30",
  timezone: "America/Los_Angeles",
  status: "confirmed",
  activity_type: "work",
  assignments: [],
  ...more,
});
// These are acceptance assertions, not a diagnostic that expects vulnerable behavior.
async function asRole(a, role, callback) {
  assert(['authenticated','sitepm_schedule_writer'].includes(role));
  return sql.begin(async tx => {
    await tx.unsafe(`set local role ${role}`);
    await tx`select set_config('request.jwt.claim.sub', ${a.user}, true)`;
    return callback(tx);
  });
}
async function revision(a, id) {
  const r = await a.client.from('schedule_activities').select('revision').eq('id',id).single();
  assert.ifError(r.error); return r.data.revision;
}
try {
  const [a,b] = await Promise.all([account('hardening-a'), account('hardening-b')]);
  const worker = resource('Isolated hardening employee', 'employee');
  assert.ifError((await save(a,'resource',worker)).error);
  const record = activity(a);
  assert.ifError((await save(a,'activity',record)).error);
  const direct = await a.client.from('schedule_assignments').insert({company_id:a.company,activity_id:record.id,resource_id:worker.id,expected_workers:1});
  assert.equal(direct.error?.code,'42501','Direct API assignment must be denied');
  await assert.rejects(asRole(a,'authenticated', tx => tx`insert into public.schedule_assignments(company_id,activity_id,resource_id) values(${a.company},${record.id},${worker.id})`), e => e.code==='42501');
  // Administrator-only role exercise confirms the trigger independently of the RPC.
  await asRole(a,'sitepm_schedule_writer', tx => tx`insert into public.schedule_assignments(company_id,activity_id,resource_id,expected_workers) values(${a.company},${record.id},${worker.id},1)`);
  assert.equal(await revision(a,record.id),2);
  assert.equal((await save(a,'activity',{...record,revision:1})).error?.code,'40001');
  const assigned = {...record,revision:2,assignments:[{resource_id:worker.id,expected_workers:2}]};
  const update = await save(a,'activity',assigned);
  assert.ifError(update.error);
  assert(update.data.revision>2,'RPC assignment change advances revision');
  const beforeRemove = update.data.revision;
  await asRole(a,'sitepm_schedule_writer', tx => tx`delete from public.schedule_assignments where activity_id=${record.id} and resource_id=${worker.id}`);
  assert.equal(await revision(a,record.id),beforeRemove+1);
  assert.equal((await save(a,'activity',{...assigned,revision:beforeRemove})).error?.code,'40001');
  console.log('PASS defect 1: authenticated direct API/SQL denied; permitted relationship changes advance revision; stale RPC rejects');

  const key=randomUUID(), current=await revision(a,record.id);
  const forgedRecord={...record,revision:current,name:'Never persisted payload'};
  const forged=await a.client.from('schedule_requests').insert({company_id:a.company,actor_id:a.user,request_id:key,payload:{kind:'activity',record:forgedRecord},result:{id:record.id,revision:current},trusted:true});
  assert.equal(forged.error?.code,'42501');
  await assert.rejects(asRole(a,'authenticated', tx => tx`insert into public.schedule_requests(company_id,actor_id,request_id,payload,result,trusted) values(${a.company},${a.user},${key},${tx.json({kind:'activity',record:forgedRecord})},${tx.json({id:record.id,revision:current})},true)`),e=>e.code==='42501');
  const confirmed=await save(a,'activity',forgedRecord,key);assert.ifError(confirmed.error);
  const repeated=await Promise.all([save(a,'activity',forgedRecord,key),save(a,'activity',forgedRecord,key)]);
  repeated.forEach(r=>{assert.ifError(r.error);assert.deepEqual(r.data,confirmed.data);});
  assert.equal(await revision(a,record.id),confirmed.data.revision);
  const name=await a.client.from('schedule_activities').select('name').eq('id',record.id).single();assert.ifError(name.error);assert.equal(name.data.name,forgedRecord.name);
  const interrupted=activity(a), interruptedKey=randomUUID();
  await assert.rejects(asRole(a,'authenticated',async tx=>{
    await tx`select public.save_construction_schedule(${interruptedKey},'activity',${tx.json(interrupted)})`;
    throw Error('Simulated disconnect before commit');
  }),/Simulated disconnect/);
  const rolledBack=await a.client.from('schedule_requests').select('request_id').eq('request_id',interruptedKey);assert.ifError(rolledBack.error);assert.equal(rolledBack.data.length,0);
  const retry=await save(a,'activity',interrupted,interruptedKey);assert.ifError(retry.error);
  assert.deepEqual((await save(a,'activity',interrupted,interruptedKey)).data,retry.data);
  // A receipt from the vulnerable predecessor is retained but never trusted.
  const legacyKey=randomUUID();
  await sql.begin(async tx => {
    await tx`select set_config('request.jwt.claim.sub',${a.user},true)`;
    await tx`insert into public.schedule_requests(company_id,actor_id,request_id,payload,result) values(${a.company},${a.user},${legacyKey},${tx.json({kind:'activity',record:forgedRecord})},${tx.json({id:record.id,revision:confirmed.data.revision})})`;
  });
  assert.equal((await save(a,'activity',forgedRecord,legacyKey)).error?.code,'40001');
  console.log('PASS defect 2: forged API/SQL receipts denied; genuine repeated/concurrent retry; pre-commit rollback/retry; untrusted legacy receipt rejected');

  const first=activity(a),second=activity(a);
  assert.ifError((await save(a,'activity',first)).error);assert.ifError((await save(a,'activity',second)).error);
  const directEdges=await Promise.allSettled([[first.id,second.id],[second.id,first.id]].map(([id,pred])=>asRole(a,'authenticated',tx=>tx`insert into public.schedule_dependencies(company_id,project_id,activity_id,predecessor_id) values(${a.company},${a.project},${id},${pred})`)));
  assert(directEdges.every(r=>r.status==='rejected' && r.reason.code==='42501'));
  const opposing=await Promise.all([save(a,'activity',{...first,revision:1,predecessor_ids:[second.id]}),save(a,'activity',{...second,revision:1,predecessor_ids:[first.id]})]);
  assert.equal(opposing.filter(r=>!r.error).length,1);
  const three=[activity(a),activity(a),activity(a)];
  for(const r of three)assert.ifError((await save(a,'activity',r)).error);
  const larger=await Promise.all(three.map((r,i)=>save(a,'activity',{...r,revision:1,predecessor_ids:[three[(i+1)%3].id]})));
  assert.equal(larger.filter(r=>!r.error).length,2);
  const maintenance=[activity(a),activity(a),activity(a)];
  for(const r of maintenance)assert.ifError((await save(a,'activity',r)).error);
  const maintenanceEdges=await Promise.allSettled(maintenance.map((r,i)=>asRole(a,'sitepm_schedule_writer',async tx=>{
    await tx`insert into public.schedule_dependencies(company_id,project_id,activity_id,predecessor_id) values(${a.company},${a.project},${r.id},${maintenance[(i+1)%3].id})`;
    await tx`select pg_sleep(0.1)`;
  })));
  assert.equal(maintenanceEdges.filter(r=>r.status==='fulfilled').length,2);
  for(const [i,r] of maintenance.entries())assert.equal(await revision(a,r.id),maintenanceEdges[i].status==='fulfilled'?2:1);
  await assert.rejects(sql.begin(async tx=>{
    await tx`set transaction isolation level repeatable read`;
    await tx`set local role authenticated`;
    await tx`select set_config('request.jwt.claim.sub',${a.user},true)`;
    await tx`select public.save_construction_schedule(${randomUUID()},'activity',${tx.json(activity(a))})`;
  }),e=>e.code==='0A000');
  console.log('PASS defect 3: direct opposing edges denied; concurrent RPC two/three-node cycles prevented; permitted direct graph writes serialize; unsupported stale-snapshot isolation rejected');

  const retained=activity(a,{assignments:[{resource_id:worker.id,expected_workers:1}]});
  const retainedSave=await save(a,'activity',retained);assert.ifError(retainedSave.error);
  assert.ifError((await save(a,'resource',{...worker,revision:1,active:false})).error);
  const metadata=await save(a,'activity',{...retained,revision:retainedSave.data.revision,notes:'Inactive resource retained as an existing historical plan'});assert.ifError(metadata.error);
  const inactiveDirect=await a.client.from('schedule_assignments').insert({company_id:a.company,activity_id:record.id,resource_id:worker.id});assert.equal(inactiveDirect.error?.code,'42501');
  await assert.rejects(asRole(a,'sitepm_schedule_writer',tx=>tx`insert into public.schedule_assignments(company_id,activity_id,resource_id) values(${a.company},${record.id},${worker.id})`),e=>e.code==='42501');
  assert((await save(a,'activity',activity(a,{assignments:[{resource_id:worker.id}]}))).error);
  assert((await save(a,'activity',{...retained,revision:metadata.data.revision,assignments:[{resource_id:worker.id,expected_workers:4}]})).error);
  assert.equal(await revision(a,retained.id),metadata.data.revision);
  const existing=await a.client.from('schedule_assignments').select('expected_workers').eq('activity_id',retained.id);assert.ifError(existing.error);assert.deepEqual(existing.data,[{expected_workers:1}]);
  assert.ifError((await save(a,'activity',{...retained,revision:metadata.data.revision,assignments:[]})).error);
  console.log('PASS defect 4: inactive new assignments rejected through every path; existing unchanged plans retained; changed counts reject atomically; removal allowed');

  const role=(await sql`select rolcanlogin,rolinherit,rolsuper,rolcreatedb,rolcreaterole,rolreplication,rolbypassrls from pg_roles where rolname='sitepm_schedule_writer'`)[0];
  assert(Object.values(role).every(v=>v===false));
  for(const name of ['authenticated','anon','authenticator','service_role'])assert.equal((await sql`select pg_has_role(${name},'sitepm_schedule_writer','MEMBER') as member`)[0].member,false);
  const fn=(await sql`select pg_get_userbyid(proowner) as owner,prosecdef,proconfig from pg_proc where oid='public.save_construction_schedule(uuid,text,jsonb)'::regprocedure`)[0];assert.equal(fn.owner,'sitepm_schedule_writer');assert(fn.prosecdef);assert(fn.proconfig.includes('search_path=""'));assert(fn.proconfig.includes('row_security=on'));
  for(const role of ['sitepm_schedule_writer','authenticated','anon'])assert.equal((await sql`select has_schema_privilege(${role},'public','CREATE') as allowed`)[0].allowed,false);
  for(const table of ['schedule_activities','schedule_dependencies','schedule_resources','schedule_assignments','schedule_requests']) {
    for(const clientRole of ['authenticated','anon','service_role'])for(const privilege of ['INSERT','UPDATE','DELETE'])assert.equal((await sql`select has_table_privilege(${clientRole},${'public.'+table},${privilege}) as allowed`)[0].allowed,false);
    const owner=(await sql`select pg_get_userbyid(relowner) as owner,relrowsecurity from pg_class where oid=${'public.'+table}::regclass`)[0];assert.notEqual(owner.owner,'sitepm_schedule_writer');assert(owner.relrowsecurity);
  }
  assert.equal((await sql`select has_table_privilege('sitepm_schedule_writer','public.field_logs','INSERT') as allowed`)[0].allowed,false);
  for(const role of ['authenticated','anon','service_role']) {
    assert.equal((await sql`select has_schema_privilege(${role},'sitepm_schedule_internal','USAGE') as allowed`)[0].allowed,false);
    assert.equal((await sql`select has_function_privilege(${role},'sitepm_schedule_internal.actor_id()','EXECUTE') as allowed`)[0].allowed,false);
  }
  const bridge=(await sql`select pg_get_userbyid(proowner) as owner,prosecdef,proconfig,prosrc from pg_proc where oid='sitepm_schedule_internal.actor_id()'::regprocedure`)[0];
  assert.equal(bridge.owner,'postgres');assert(bridge.prosecdef);assert(bridge.proconfig.includes('search_path=""'));assert.equal(bridge.prosrc.trim(),'select auth.uid()');
  assert.equal((await sql`select has_function_privilege('service_role','public.save_construction_schedule(uuid,text,jsonb)','EXECUTE') as allowed`)[0].allowed,false);
  const hidden=await asRole(b,'sitepm_schedule_writer',tx=>tx`select id from public.schedule_resources where company_id=${a.company}`);assert.equal(hidden.length,0);
  await assert.rejects(asRole(b,'sitepm_schedule_writer',tx=>tx`insert into public.schedule_assignments(company_id,activity_id,resource_id) values(${a.company},${record.id},${worker.id})`));
  await Promise.all([a.client.auth.signOut(),b.client.auth.signOut()]);
  console.log('PASS writer privilege/search_path/RLS review; no client role membership or unrelated write privileges; tenant isolation under actual function-owner role');
  console.log('All four scheduling integrity defects RESOLVED in isolated acceptance.');
} finally { await sql.end(); }
