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
  const [a, b] = await Promise.all([account("a"), account("b")]);
  const employee = resource("Isolated employee", "employee"),
    sub = resource("Isolated electrician", "subcontractor_company"),
    other = resource("Company B resource");
  for (const r of [employee, sub])
    assert.ifError((await save(a, "resource", r)).error);
  assert.ifError((await save(b, "resource", other)).error);
  const job2 = await a.client
    .from("projects")
    .insert({ company_id: a.company, name: "Isolated second job" })
    .select("id")
    .single();
  assert.ifError(job2.error);
  const task = await a.client
    .from("tasks")
    .insert({
      company_id: a.company,
      project_id: a.project,
      title: "Isolated rough-in follow-up",
    })
    .select("id")
    .single();
  assert.ifError(task.error);
  const record = activity(a, {
    source_task_id: task.data.id,
    assignments: [
      { resource_id: employee.id, expected_workers: 1 },
      { resource_id: sub.id, expected_workers: 3 },
    ],
  });
  const key = randomUUID();
  const created = await save(a, "activity", record, key);
  assert.ifError(created.error);
  assert.equal(created.data.revision, 1);
  const replay = await save(a, "activity", record, key);
  assert.ifError(replay.error);
  assert.equal(replay.data.id, record.id);
  assert(
    (await save(a, "activity", { ...record, name: "Changed" }, key)).error,
  );
  const rows = await a.client
    .from("schedule_assignments")
    .select("*")
    .eq("activity_id", record.id);
  assert.ifError(rows.error);
  assert.equal(rows.data.length, 2);
  assert.equal(
    (
      await a.client
        .from("schedule_activities")
        .select("start_at")
        .eq("id", record.id)
        .single()
    ).data.start_at,
    "2026-10-08T14:00:00+00:00",
  );
  const edits = await Promise.all([
    save(a, "activity", { ...record, revision: 1, name: "Editor one" }),
    save(a, "activity", { ...record, revision: 1, name: "Editor two" }),
  ]);
  assert.equal(edits.filter((r) => !r.error).length, 1);
  assert.equal(edits.filter((r) => r.error?.code === "40001").length, 1);
  const now = await a.client
    .from("schedule_activities")
    .select("*")
    .eq("id", record.id)
    .single();
  assert.equal(now.data.revision, 2);
  const historyBefore = (
    await a.client
      .from("schedule_history")
      .select("id")
      .eq("activity_id", record.id)
  ).data.length;
  assert(
    (
      await save(a, "activity", {
        ...record,
        revision: 2,
        name: "Must roll back",
        assignments: [{ resource_id: other.id, expected_workers: 4 }],
      })
    ).error,
  );
  const unchanged = await a.client
    .from("schedule_activities")
    .select("revision,name")
    .eq("id", record.id)
    .single();
  assert.equal(unchanged.data.revision, 2);
  assert.equal(unchanged.data.name, now.data.name);
  assert.equal(
    (
      await a.client
        .from("schedule_assignments")
        .select("*")
        .eq("activity_id", record.id)
    ).data.length,
    2,
  );
  assert.equal(
    (
      await a.client
        .from("schedule_history")
        .select("id")
        .eq("activity_id", record.id)
    ).data.length,
    historyBefore,
  );
  console.log(
    "PASS employee/subcontractor/multiple assignments; timed persistence; exact retry; concurrent edit; cross-company assignment rollback and audit rollback",
  );
  for (const table of [
    "schedule_activities",
    "schedule_resources",
    "schedule_assignments",
    "schedule_history",
    "schedule_requests",
  ]) {
    const r = await b.client
      .from(table)
      .select("company_id")
      .eq("company_id", a.company);
    assert.ifError(r.error);
    assert.equal(r.data.length, 0);
  }
  assert((await save(b, "activity", { ...record, revision: 2 })).error);
  assert((await save(b, "resource", { ...employee, revision: 1 })).error);
  const deniedInsert = await b.client
    .from("schedule_resources")
    .insert({ ...employee, id: randomUUID(), company_id: a.company });
  assert(deniedInsert.error);
  const deniedUpdate = await b.client
    .from("schedule_activities")
    .update({ name: "Forged" })
    .eq("id", record.id)
    .select("id");
  assert.equal(deniedUpdate.data?.length ?? 0, 0);
  const forged = await b.client.from("schedule_assignments").insert({
    company_id: b.company,
    activity_id: record.id,
    resource_id: other.id,
  });
  assert(forged.error);
  const foreignJob = activity(a, { project_id: b.project });
  assert((await save(a, "activity", foreignJob)).error);
  const foreignTask = activity(a, {
    project_id: job2.data.id,
    source_task_id: task.data.id,
  });
  assert((await save(a, "activity", foreignTask)).error);
  const anon = createClient(env.API_URL, env.ANON_KEY, {
    auth: { persistSession: false },
  });
  assert(
    (
      await anon.rpc("save_construction_schedule", {
        p_request_id: randomUUID(),
        p_kind: "activity",
        p_record: record,
      })
    ).error,
  );
  assert(
    (
      await a.client.from("schedule_history").insert({
        company_id: a.company,
        activity_id: record.id,
        change_type: "forged",
      })
    ).error,
  );
  assert(
    (
      await b.client.from("schedule_requests").insert({
        company_id: b.company,
        actor_id: b.user,
        request_id: randomUUID(),
        payload: { kind: "activity", record },
        result: { id: record.id, revision: 2 },
      })
    ).error,
  );
  assert(
    (await a.client.from("schedule_activities").delete().eq("id", record.id))
      .error,
  );
  console.log(
    "PASS tenant read/write isolation; unauthorized insert/update; cross-job task; forged assignment/receipt/history; anonymous rejection; hard-delete refused",
  );
  for (const more of [
    { start_date: "2026-02-30" },
    { finish_date: "2026-10-07" },
    { start_time: "17:00", finish_time: "08:00" },
    { start_time: "25:00" },
    { timezone: "Not/A_Zone" },
    { status: "present" },
    { activity_type: "forecast" },
    { activity_type: "milestone", finish_date: "2026-10-09" },
    {
      start_date: "2026-03-08",
      finish_date: "2026-03-08",
      start_time: "02:30",
      finish_time: "04:00",
    },
    { assignments: [{ resource_id: employee.id, expected_workers: -1 }] },
    {
      assignments: [{ resource_id: employee.id }, { resource_id: employee.id }],
    },
  ])
    assert(
      (await save(a, "activity", activity(a, more))).error,
      JSON.stringify(more),
    );
  const parent = activity(a, {
    name: "Parent",
    all_day: true,
    start_time: "",
    finish_time: "",
  });
  assert.ifError((await save(a, "activity", parent)).error);
  const child = activity(a, {
    name: "Child",
    predecessor_id: parent.id,
    all_day: true,
    start_time: "",
    finish_time: "",
  });
  assert.ifError((await save(a, "activity", child)).error);
  assert(
    (
      await save(a, "activity", {
        ...parent,
        revision: 1,
        predecessor_id: child.id,
      })
    ).error,
  );
  assert(
    (
      await save(
        a,
        "activity",
        activity(a, { predecessor_id: record.id, project_id: job2.data.id }),
      )
    ).error,
  );
  const multi = activity(a, { predecessor_ids: [parent.id, child.id] });
  assert.ifError((await save(a, "activity", multi)).error);
  assert.ifError(
    (
      await save(a, "activity", {
        ...multi,
        revision: 1,
        name: "Updated multiple predecessors",
      })
    ).error,
  );
  const multiRows = await a.client
    .from("schedule_dependencies")
    .select("predecessor_id")
    .eq("activity_id", multi.id);
  assert.ifError(multiRows.error);
  assert.deepEqual(
    multiRows.data.map((x) => x.predecessor_id).sort(),
    [parent.id, child.id].sort(),
  );
  assert(
    (await save(a, "activity", activity(a, { assignments: undefined }))).error,
  );
  const depHistory = await a.client
    .from("schedule_history")
    .select("change_type")
    .eq("activity_id", multi.id);
  assert.ifError(depHistory.error);
  assert.equal(
    depHistory.data.filter((x) => x.change_type === "dependency_insert").length,
    2,
  );
  assert(!depHistory.data.some((x) => x.change_type === "dependency_delete"));
  const unchangedAssignmentRecord = activity(a, {
    assignments: [{ resource_id: sub.id, expected_workers: 3 }],
  });
  assert.ifError((await save(a, "activity", unchangedAssignmentRecord)).error);
  assert.ifError(
    (
      await save(a, "activity", {
        ...unchangedAssignmentRecord,
        revision: 1,
        notes: "Only description changed",
      })
    ).error,
  );
  const unchangedAssignmentRecordHistory = await a.client
    .from("schedule_history")
    .select("change_type")
    .eq("activity_id", unchangedAssignmentRecord.id);
  assert.ifError(unchangedAssignmentRecordHistory.error);
  assert.equal(
    unchangedAssignmentRecordHistory.data.filter((x) => x.change_type === "assignment_insert")
      .length,
    1,
  );
  assert(
    !unchangedAssignmentRecordHistory.data.some((x) => x.change_type === "assignment_delete"),
  );
  const cancelled = await save(a, "activity", {
    ...record,
    revision: 2,
    status: "cancelled",
    start_date: "2026-10-09",
    finish_date: "2026-10-09",
  });
  assert.ifError(cancelled.error);
  assert.equal(cancelled.data.revision, 3);
  const oldReplay = await save(a, "activity", record, key);
  assert.ifError(oldReplay.error);
  assert.equal(
    (
      await a.client
        .from("schedule_activities")
        .select("status")
        .eq("id", record.id)
        .single()
    ).data.status,
    "cancelled",
  );
  const h = await a.client
    .from("schedule_history")
    .select("*")
    .eq("activity_id", record.id)
    .order("occurred_at");
  assert.ifError(h.error);
  assert(h.data.some((x) => x.after_record?.status === "cancelled"));
  assert(h.data.every((x) => x.actor_id === a.user));
  assert(h.data.some((x) => x.after_record?.start_date === "2026-10-08"));
  const inactive = await save(a, "resource", {
    ...employee,
    revision: 1,
    active: false,
  });
  assert.ifError(inactive.error);
  assert(
    (
      await save(
        a,
        "activity",
        activity(a, {
          assignments: [{ resource_id: employee.id, expected_workers: 1 }],
        }),
      )
    ).error,
  );
  const dup = activity(a),
    dupKey = randomUUID();
  const twice = await Promise.all([
    save(a, "activity", dup, dupKey),
    save(a, "activity", dup, dupKey),
  ]);
  twice.forEach((r) => assert.ifError(r.error));
  assert.equal(twice[0].data.id, twice[1].data.id);
  console.log(
    "PASS invalid dates/times/timezones/DST gap/counts; dependency cycle/same-job integrity; reschedule/cancel audit; inactive rejection; delayed replay; concurrent duplicate",
  );
  await Promise.all([a.client.auth.signOut(), b.client.auth.signOut()]);
  console.log("Isolated construction scheduling database acceptance PASSED.");
} finally {
  await sql.end();
}
