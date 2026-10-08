import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { createClient } from "@supabase/supabase-js";
const env = parseEnv(readFileSync(".env.isolated.local", "utf8"));
for (const [name, port] of [
  ["API_URL", "55431"],
  ["DB_URL", "55432"],
]) {
  const u = new URL(env[name]);
  assert(
    ["127.0.0.1", "localhost"].includes(u.hostname) && u.port === port,
    "Isolated localhost only",
  );
}
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
try {
  const a = await account("review");
  const worker = resource("Isolated review employee", "employee");
  assert.ifError((await save(a, "resource", worker)).error);
  const record = activity(a);
  assert.ifError((await save(a, "activity", record)).error);
  assert.ifError((await a.client.from("schedule_assignments").insert({
    company_id: a.company, activity_id: record.id, resource_id: worker.id, expected_workers: 1,
  })).error);
  const before = await a.client.from("schedule_activities").select("revision").eq("id", record.id).single();
  assert.ifError(before.error);
  const stale = await save(a, "activity", {...record, revision: 1, name: "Stale editor"});
  const after = await a.client.from("schedule_assignments").select("resource_id").eq("activity_id", record.id);
  assert.ifError(after.error);
  const lostAssignment = before.data.revision === 1 && !stale.error && after.data.length === 0;
  console.log(lostAssignment ? "BLOCKER: direct assignment did not advance revision; stale RPC erased assignment" : "PASS: direct assignment cannot be silently erased by stale RPC");

  const current = await a.client.from("schedule_activities").select("revision,name").eq("id", record.id).single();
  assert.ifError(current.error);
  const request = randomUUID();
  const forgedRecord = {...record, revision: current.data.revision, name: "Never persisted payload"};
  const receipt = await a.client.from("schedule_requests").insert({
    company_id: a.company, actor_id: a.user, request_id: request,
    payload: {kind: "activity", record: forgedRecord},
    result: {id: record.id, revision: current.data.revision},
  });
  const replay = await save(a, "activity", forgedRecord, request);
  const persisted = await a.client.from("schedule_activities").select("name").eq("id", record.id).single();
  assert.ifError(persisted.error);
  const falseSuccess = !receipt.error && !replay.error && persisted.data.name !== forgedRecord.name;
  console.log(falseSuccess ? "BLOCKER: same-tenant forged receipt returned success without persisting payload" : "PASS: forged receipt cannot claim an unpersisted write");
  const inactive = await save(a, "resource", {...worker, revision: 1, active: false});
  assert.ifError(inactive.error);
  const inactiveAssignment = await a.client.from("schedule_assignments").insert({
    company_id: a.company, activity_id: record.id, resource_id: worker.id, expected_workers: 1,
  });
  console.log(!inactiveAssignment.error ? "BLOCKER: direct insert assigned an inactive resource" : "PASS: inactive direct assignment rejected");

  const first = activity(a), second = activity(a);
  assert.ifError((await save(a, "activity", first)).error);
  assert.ifError((await save(a, "activity", second)).error);
  let arrivals = 0, release;
  const barrier = new Promise(resolve => { release = resolve; });
  await Promise.all([[first.id, second.id], [second.id, first.id]].map(([id, predecessor]) =>
    sql.begin(async tx => {
      await tx`set local role authenticated`;
      await tx`select set_config('request.jwt.claim.sub', ${a.user}, true)`;
      await tx`insert into public.schedule_dependencies(company_id,project_id,activity_id,predecessor_id) values(${a.company},${a.project},${id},${predecessor})`;
      if (++arrivals === 2) release();
      await barrier;
    })
  ));
  const graph = await a.client.from("schedule_dependencies").select("activity_id,predecessor_id").in("activity_id", [first.id, second.id]);
  assert.ifError(graph.error);
  const cycle = graph.data.length === 2;
  console.log(cycle ? "BLOCKER: concurrent direct dependency inserts committed a two-activity cycle" : "PASS: concurrent dependency cycle prevented");
  await a.client.auth.signOut();
  if (lostAssignment || falseSuccess || !inactiveAssignment.error || cycle) process.exitCode = 1;
} finally {
  await sql.end();
}
