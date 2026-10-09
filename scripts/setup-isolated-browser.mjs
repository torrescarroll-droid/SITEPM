import assert from 'node:assert/strict';
import { readFileSync,writeFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { createClient } from '@supabase/supabase-js';
const env=parseEnv(readFileSync('.env.isolated.local','utf8'));
const url=new URL(env.API_URL);assert(['127.0.0.1','localhost'].includes(url.hostname)&&url.port==='55431');
const fixtures=[];
for(const label of ['a','b']) {
 const client=createClient(env.API_URL,env.ANON_KEY,{auth:{persistSession:false}});
 const email=`browser-${label}@sitepm.test`,password='Local-only-SITEPM-test-2026!';
 let signed=await client.auth.signInWithPassword({email,password});
 if(signed.error)signed=await client.auth.signUp({email,password,options:{data:{company_name:`Browser company ${label}`,full_name:`Browser ${label}`}}});
 assert.ifError(signed.error);assert(signed.data.session);
 const profile=await client.from('profiles').select('company_id').single();assert.ifError(profile.error);
 const created=await client.from('projects').insert({company_id:profile.data.company_id,name:`Browser reliability ${label}`}).select('id').single();assert.ifError(created.error);
 fixtures.push({label,email,project:created.data.id,company:profile.data.company_id});
 await client.auth.signOut();
}
writeFileSync('.env.isolated-browser.local',JSON.stringify(fixtures));
console.log(JSON.stringify(fixtures));
