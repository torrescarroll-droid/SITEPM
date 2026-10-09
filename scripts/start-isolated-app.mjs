import { isolatedEnvironment } from "./isolated-environment.mjs";
import { spawn } from 'node:child_process';
const env = isolatedEnvironment();
const production=process.argv.includes('--production');
const args=process.argv.includes('--build')?['build','--webpack']:production?['start','--hostname','127.0.0.1','--port','3107']:['dev','--webpack','--hostname','127.0.0.1','--port','3107'];
const child=spawn(process.execPath,['node_modules/next/dist/bin/next',...args],{stdio:'inherit',env:{...process.env,SUPABASE_URL:env.API_URL,SUPABASE_ANON_KEY:env.ANON_KEY}});
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>child.kill(signal));
child.on('exit',code=>process.exit(code??1));
