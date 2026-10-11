/** Recovery-only HTTP acceptance. Input holds only a publishable key, never passwords. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const input=JSON.parse(readFileSync(process.argv[2],'utf8'));
assert.equal(input.project,'sdqnkvpparemaptbqnkj','Recovery project only');
const resume=process.argv.includes('--resumed');
const results=[];
try {
 for(const [method,path,body] of [
  ['GET','/rest/v1/rpc/current_company_id',undefined],
  // An empty row array cannot create a record, even if the pause is broken.
  ['POST','/rest/v1/projects',[]],
  ['PATCH','/rest/v1/projects?id=eq.00000000-0000-0000-0000-000000000000',{}],
  ['DELETE','/rest/v1/projects?id=eq.00000000-0000-0000-0000-000000000000',undefined],
  ['POST','/rest/v1/rpc/current_company_id',{}],
 ]) {
  const response=await fetch('https://'+input.project+'.supabase.co'+path,{
   method,headers:{apikey:input.key,'Content-Type':'application/json'},
   body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(15000),
  });
  let payload;try{payload=await response.json();}catch{payload=null;}
  const paused=payload?.message==='SITEPM_RELEASE_PAUSED';
  results.push({method,rpc:path.includes('/rpc/'),status:response.status,code:payload?.code,error:response.ok?undefined:payload?.message,paused});
  if(method==='GET') assert(response.ok || payload?.code==='42501','Read route must remain available subject to original permissions');
  else if(resume) assert(!paused,'Pause remained after resume');
  else {assert.equal(response.status,503);assert.equal(payload?.code,'PT503');assert(paused);}
 }
 console.log(JSON.stringify({result:'PASS',mode:resume?'resumed':'paused',checks:results},null,2));
} catch(error) {
 console.log(JSON.stringify({result:'FAIL',checks:results,category:error.cause?.code??error.code??error.name}));
 process.exitCode=1;
}
