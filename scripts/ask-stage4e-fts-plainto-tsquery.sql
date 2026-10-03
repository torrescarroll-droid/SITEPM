-- SITEPM Stage 4E-B operator inspection ONLY.
-- Does not mutate data. Does not change production functions.
-- Run in SQL Editor as a read-only query if the role allows SELECT from pg_catalog.
-- NOT executed by npm run test:stage4e-fts.
--
-- POSTGRESQL FTS BENCHMARK — RP001 BENCHMARK DATABASE ADAPTER
-- NOT production upload / Storage / PDF extraction / Ask validation.
--
-- Exact Q01, Q02, Q09, Q14 natural-language questions from ground-truth.json.

select 'Q01' as id,
  pg_catalog.plainto_tsquery(
    'english',
    'Where is the living-room radiant heating, which manifold serves it, and has it been serviced?'
  )::text as tsquery;

select 'Q02' as id,
  pg_catalog.plainto_tsquery(
    'english',
    'Who installed the radiant system, under which contract, and whom should the record direct service inquiries to?'
  )::text as tsquery;

select 'Q09' as id,
  pg_catalog.plainto_tsquery(
    'english',
    'Were both living-room actuators replaced in November 2029?'
  )::text as tsquery;

select 'Q14' as id,
  pg_catalog.plainto_tsquery(
    'english',
    'Which loop would you investigate for the west-floor complaint?'
  )::text as tsquery;
