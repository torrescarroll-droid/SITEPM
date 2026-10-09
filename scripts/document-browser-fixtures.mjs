/** Browser fault injection and evidence. Dedicated loopback database only. */
import { isolatedEnvironment } from "./isolated-environment.mjs";
import postgres from "postgres";
const env = isolatedEnvironment();
const sql = postgres(env.DB_URL, { max: 1 });
try {
  const mode = process.argv[2];
  if (["delay", "reject"].includes(mode)) {
    await sql.unsafe(`drop trigger if exists isolated_document_fault on public.document_versions;
      create or replace function public.isolated_document_fault() returns trigger language plpgsql set search_path='' as $$
      begin
        if new.verified_at is not null and old.verified_at is null and exists(
          select 1 from public.document_families f where f.id=new.family_id and f.title like 'Browser acceptance recovery%'
        ) then ${mode === "delay" ? "perform pg_catalog.pg_sleep(15);" : "raise exception 'Synthetic isolated verification rejection';"} end if;
        return new;
      end $$;
      revoke all on function public.isolated_document_fault() from public,anon,authenticated;
      create trigger isolated_document_fault before update on public.document_versions for each row execute function public.isolated_document_fault();`);
    console.log(`Isolated document verification fault: ${mode}`);
  } else if (mode === "off") {
    await sql.unsafe(
      "drop trigger if exists isolated_document_fault on public.document_versions; drop function if exists public.isolated_document_fault();",
    );
    console.log("Isolated document fault removed");
  } else if (mode === "inspect") {
    const rows = await sql`select f.id,f.title,f.current_document_id,f.archived,
      d.id document_id,d.status,v.version_number,v.verified_at,
      (select count(*)::int from public.document_upload_attempts a where a.document_id=d.id) attempts,
      (select count(*)::int from public.document_upload_attempts a where a.document_id=d.id and a.verified_at is not null) verified_receipts,
      (select count(*)::int from public.document_links l where l.document_id=d.id) links
      from public.document_families f join public.document_versions v on v.family_id=f.id
      join public.documents d on d.id=v.document_id where f.title like 'Browser acceptance%'
      order by f.title,v.version_number`;
    console.log(JSON.stringify(rows));
  } else throw Error("Use delay, reject, off, or inspect");
} finally {
  await sql.end();
}
