/** Prepare a separate fresh LOCAL Supabase stack. Does not connect, start, reset or delete a database. */
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, readdirSync, copyFileSync, writeFileSync } from 'node:fs';
import { resolve, join, basename } from 'node:path';
const root=resolve(process.argv[2] ?? '/private/tmp/sitepm-scheduling-hardening');
assert(root.startsWith('/private/tmp/') && !existsSync(root),'Choose a new /private/tmp directory; existing work is preserved');
mkdirSync(join(root,'supabase','migrations'),{recursive:true});
let config=readFileSync('supabase/config.toml','utf8').replaceAll('sitepm-isolated',basename(root));
for(const [from,to] of [['55430','55440'],['55431','55441'],['55432','55442'],['55433','55443'],['55434','55444'],['55439','55449']])config=config.replaceAll(from,to);
// Keep the same current CLI/REST generation as the established SITEPM stack.
config=config.replace('sign_in_sign_ups = 30','sign_in_sign_ups = 1000');
writeFileSync(join(root,'supabase','config.toml'),config);
assert(existsSync('supabase/migrations/19700101000000_local_baseline.sql'),'Run npm run db:isolated:prepare first');
// Initialize managed Auth before installing the custom writer role/ACLs.
for(const file of readdirSync('supabase/migrations').filter(f=>f.endsWith('.sql') && !f.includes('construction_scheduling') && !f.includes('scheduling_integrity_boundary')))copyFileSync(join('supabase/migrations',file),join(root,'supabase','migrations',file));
console.log(`Prepared clean local replay workspace ${root}; no database connection made.`);
