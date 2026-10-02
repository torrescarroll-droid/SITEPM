-- SITEPM Week 9 / Ask Stage 4C — project-scoped FTS retrieval (SELECT-shaped)
-- Additive. Does not change documents identity, Storage, Ask, or 4B writer grants.
-- Does not add embeddings or a vector extension.
-- Apply in the hosted SITEPM Supabase SQL Editor when authorized.
-- Single transaction: any error before COMMIT rolls back.
--
-- Why a function (not PostgREST .textSearch alone):
--   Ranking must use pg_catalog.ts_rank_cd(search_vector, query) with
--   stable identity tie-breaks (including chunk id) and a hard LIMIT.
--   PostgREST cannot express that ORDER BY. The function is SECURITY INVOKER
--   so existing RLS on document_chunks still applies. It does not take
--   company_id from the caller.

begin;

create or replace function public.search_project_document_chunks(
  p_project_id uuid,
  p_query text,
  p_as_of date default null,
  p_limit integer default 25
)
returns table (
  company_id uuid,
  project_id uuid,
  document_id uuid,
  extraction_id uuid,
  chunk_id uuid,
  source_sha256 text,
  content_kind text,
  locator text,
  locator_type text,
  part_index integer,
  source_issued_on date,
  source_effective_on date,
  body text
)
language plpgsql
stable
security invoker
set search_path = pg_catalog, public
as $$
declare
  q tsquery;
  capped integer;
  caller_company uuid;
begin
  caller_company := public.current_company_id();
  if caller_company is null or p_project_id is null then
    return;
  end if;

  if p_query is null or char_length(trim(p_query)) = 0 then
    return;
  end if;

  if not exists (
    select 1
    from public.projects as p
    where p.id = p_project_id
      and p.company_id = caller_company
  ) then
    return;
  end if;

  q := pg_catalog.plainto_tsquery('english', left(trim(p_query), 500));
  if q is null or q = ''::tsquery then
    return;
  end if;

  capped := least(greatest(coalesce(p_limit, 25), 1), 25);

  return query
  select
    c.company_id,
    c.project_id,
    c.document_id,
    c.extraction_id,
    c.id,
    c.source_sha256,
    c.content_kind,
    c.locator,
    c.locator_type,
    c.part_index,
    c.source_issued_on,
    c.source_effective_on,
    c.body
  from public.document_chunks as c
  where c.project_id = p_project_id
    and c.company_id = caller_company
    and (
      p_as_of is null
      or c.source_issued_on is null
      or c.source_issued_on <= p_as_of
    )
    and c.search_vector @@ q
  order by
    pg_catalog.ts_rank_cd(c.search_vector, q) desc,
    c.document_id asc,
    c.locator asc,
    c.part_index asc,
    c.id asc
  limit capped;
end;
$$;

comment on function public.search_project_document_chunks(uuid, text, date, integer) is
  'Stage 4C SECURITY INVOKER FTS over document_chunks. RLS still applies. Not Ask/LLM. Empty/unparseable queries return no rows.';

revoke all on function public.search_project_document_chunks(uuid, text, date, integer) from public;
revoke all on function public.search_project_document_chunks(uuid, text, date, integer) from anon;
grant execute on function public.search_project_document_chunks(uuid, text, date, integer) to authenticated;

-- 4A/4B write boundary unchanged.
revoke all on table public.document_extractions from anon, authenticated, public;
grant select on table public.document_extractions to authenticated;
revoke all on table public.document_chunks from anon, authenticated, public;
grant select on table public.document_chunks to authenticated;

revoke all on function public.replace_document_extraction() from public;
revoke all on function public.replace_document_extraction() from anon;
revoke all on function public.replace_document_extraction() from authenticated;

revoke all on function public.replace_ready_document_extraction(
  uuid, text, text, text, text, text, date, date, jsonb
) from public;
revoke all on function public.replace_ready_document_extraction(
  uuid, text, text, text, text, text, date, date, jsonb
) from anon;
revoke all on function public.replace_ready_document_extraction(
  uuid, text, text, text, text, text, date, date, jsonb
) from authenticated;

commit;
