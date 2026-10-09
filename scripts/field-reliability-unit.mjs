import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { createJiti } from 'jiti';
const jiti=createJiti(import.meta.url,{alias:{'@':process.cwd()},fsCache:false});
const daily=await jiti.import('../lib/daily-report.ts');
const dates=await jiti.import('../lib/operational-lookahead.ts');
const ids={project:'11111111-1111-4111-8111-111111111111',report:'22222222-2222-4222-8222-222222222222',request:'33333333-3333-4333-8333-333333333333'};
function harness(options={}) {
 const calls=[],paths=[];const module={exports:{}};
 const mocks={
  'next/cache':{revalidatePath:path=>{paths.push(path);if(options.refreshThrows)throw Error('cache');}},
  '@/lib/auth-context':{requireCompanyContext:async()=>({profile:options.noCompany?null:{company_id:'company-a'},supabase:{rpc:async(name,args)=>{calls.push({name,args});if(options.throws)throw Error('lost response');return options.result??{data:[{report_id:ids.report,project_id:ids.project,revision:2}],error:null};}}})},
  '@/lib/daily-report':daily,'@/lib/operational-lookahead':dates,
 };
 const output=ts.transpileModule(readFileSync('lib/field-log-actions.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 runInNewContext(output,{module,exports:module.exports,require:name=>{assert(name in mocks,name);return mocks[name];},FormData,Date});
 return {actions:module.exports,calls,paths};
}
function form(more={}) {const f=new FormData();for(const[k,v]of Object.entries({project_id:ids.project,request_id:ids.request,log_date:'2026-10-07',work_performed:'Framing',crew_trade:'Carpentry',crew_count:'3',company_id:'forged-company',...more}))f.set(k,v);return f;}
let h=harness();let r=await h.actions.createFieldLog({},form());assert.equal(r.error,null);assert.equal(h.calls.length,1);assert.equal(h.calls[0].name,'save_field_report');assert(!('company_id' in h.calls[0].args));assert.equal(h.calls[0].args.p_crews[0].workerCount,3);assert(h.paths.includes(`/projects/${ids.project}/lookahead`));
for(const invalid of [{log_date:'2026-02-30'},{crew_count:'2147483648'},{crew_trade:''},{work_performed:''},{request_id:''},{follow_up_title:'x'.repeat(501)}]) {h=harness();assert((await h.actions.createFieldLog({},form(invalid))).error);assert.equal(h.calls.length,0);}
h=harness();assert.equal((await h.actions.updateFieldLog({},form({field_log_id:ids.report,expected_revision:'1',follow_up_title:'ignored'}))).error,null);assert.equal(h.calls[0].args.p_expected_revision,1);assert.equal(h.calls[0].args.p_follow_up,null);
for(const code of ['42501','40001','23514','PGRST202']) {h=harness({result:{data:null,error:{code,message:'private database details'}}});r=await h.actions.createFieldLog({},form());assert(r.error);assert(!r.error.includes('private database details'));assert.equal(r.reportId,null);assert.equal(r.uncertain,false);assert.equal(h.paths.length,0);}
for(const options of [{throws:true},{result:{data:null,error:{code:'',message:'network'}}},{result:{data:[],error:null}}]) {h=harness(options);r=await h.actions.createFieldLog({},form());assert(r.uncertain);assert.equal(r.reportId,null);assert.equal(h.paths.length,0);}
h=harness({refreshThrows:true});assert.equal((await h.actions.createFieldLog({},form())).error,null,'Cache refresh cannot turn confirmed save into retryable create');
h=harness({noCompany:true});assert((await h.actions.createFieldLog({},form())).error);assert.equal(h.calls.length,0);
console.log('PASS field save actions: single atomic RPC, server validation, company not client-controlled, error classification, uncertain retry, stale save, cache-failure confirmation');

const { clearOtherReportDrafts }=await jiti.import('../lib/report-draft-storage.ts');
const entries=new Map([['sitepm-report-v1:company-a:user-a:new','a'],['sitepm-report-v1:company-b:user-b:new','b'],['unrelated','keep']]);
const storage={get length(){return entries.size;},key:index=>[...entries.keys()][index]??null,removeItem:key=>entries.delete(key)};
clearOtherReportDrafts(storage,'user-b');assert(!entries.has('sitepm-report-v1:company-a:user-a:new'));assert(entries.has('sitepm-report-v1:company-b:user-b:new'));assert(entries.has('unrelated'));
clearOtherReportDrafts(storage);assert.deepEqual([...entries.keys()],['unrelated']);
console.log('PASS tab draft storage: account switch removes other users drafts, logout clears report drafts, unrelated storage retained');
