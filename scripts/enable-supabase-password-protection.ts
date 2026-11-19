/** Enable and verify hosted Auth protection without printing credentials/config. */
import {readFile} from 'node:fs/promises';
import {homedir} from 'node:os';
async function main(){
let token=process.env.SUPABASE_ACCESS_TOKEN?.trim();
if(!token){try{token=(await readFile(`${homedir()}/.supabase/access-token`,'utf8')).trim();}catch{/* Try project credentials below. */}}
if(!token){const env=await readFile('.env.local','utf8');token=env.match(/^SUPABASE_ACCESS_TOKEN=(.+)$/m)?.[1]?.trim().replace(/^["']|["']$/g,'');}
if(!token)throw new Error('Supabase management sign-in is required.');
const url='https://api.supabase.com/v1/projects/rtoebbwzwxcnscsxghww/config/auth';
const response=await fetch(url,{method:'PATCH',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({password_hibp_enabled:true}),signal:AbortSignal.timeout(15000)});
if(!response.ok)throw new Error(`Supabase password protection update failed (${response.status}). Renew management access before retrying.`);
const result=await fetch(url,{headers:{Authorization:`Bearer ${token}`},signal:AbortSignal.timeout(15000)});
if(!result.ok||(await result.json()).password_hibp_enabled!==true)throw new Error('Supabase password protection could not be verified.');
console.log('Hosted breached-password protection is enabled and verified.');

}
main().catch(error=>{console.error(error instanceof Error?error.message:"Password protection update failed.");process.exitCode=1;});
