import { isolatedEnvironment } from "./isolated-environment.mjs";
/** Synthetic browser fault controls, restricted to the dedicated local database. */
import assert from "node:assert/strict";
import postgres from "postgres";
const env = isolatedEnvironment();
const sql = postgres(env.DB_URL, { max: 1 });
try {
  const mode = process.argv[2];
  if (mode === "on")
    await sql.unsafe(
      `create or replace function public.isolated_schedule_delay() returns trigger language plpgsql set search_path='' as $$ begin if new.name='Isolated browser interrupted schedule' then perform pg_catalog.pg_sleep(8); end if; return new; end $$; create trigger isolated_schedule_delay before insert on public.schedule_activities for each row execute function public.isolated_schedule_delay();`,
    );
  else if (mode === "off")
    await sql.unsafe(
      "drop trigger if exists isolated_schedule_delay on public.schedule_activities; drop function if exists public.isolated_schedule_delay();",
    );
  else if (mode === "stale") {
    const r =
      await sql`update public.schedule_activities set notes='Synthetic concurrent editor' where id=${process.argv[3]} and company_id=(select company_id from public.profiles where email='browser-a@sitepm.test') returning revision`;
    assert.equal(r.length, 1);
    console.log(JSON.stringify(r));
  } else if (mode === "inspect") {
    const r =
      await sql`select a.id,a.name,a.revision,a.status,a.start_date::text,a.finish_date::text,(select count(*)::int from public.schedule_assignments s where s.activity_id=a.id) assignments,(select count(*)::int from public.schedule_requests r where r.result->>'id'=a.id::text) receipts from public.schedule_activities a join public.profiles p on p.id=a.created_by where p.email='browser-a@sitepm.test' order by a.created_at`;
    console.log(JSON.stringify(r));
  } else throw Error("Use on, off, stale <synthetic activity UUID>, inspect");
} finally {
  await sql.end();
}
