/** Inventory response boundaries; optionally exercise anonymous requests against a loopback lab only. */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

async function main(){
const root=process.cwd();
const verbs=new Set(['GET','POST','PUT','PATCH','DELETE','HEAD','OPTIONS']);
const routes:Array<{file:string;url:string;methods:string[];guards:string[];sensitiveReferences:string[]}>=[];
function walk(dir:string){for(const entry of readdirSync(dir,{withFileTypes:true})){
 const filename=path.join(dir,entry.name);if(entry.isDirectory()){walk(filename);continue;}if(entry.name!=='route.ts')continue;
 const text=readFileSync(filename,'utf8');const source=ts.createSourceFile(filename,text,ts.ScriptTarget.Latest,true);
 const methods:string[]=[];
 for(const node of source.statements){
  if(ts.isFunctionDeclaration(node)&&node.name&&verbs.has(node.name.text)&&node.modifiers?.some(m=>m.kind===ts.SyntaxKind.ExportKeyword))methods.push(node.name.text);
  if(ts.isVariableStatement(node)&&node.modifiers?.some(m=>m.kind===ts.SyntaxKind.ExportKeyword))for(const d of node.declarationList.declarations)if(ts.isIdentifier(d.name)&&verbs.has(d.name.text))methods.push(d.name.text);
 }
 routes.push({file:path.relative(root,filename),url:'/'+path.relative(path.join(root,'src/app'),path.dirname(filename)).split(path.sep).join('/'),methods,
  guards:['requireAdminPermission','requireDashboardSession','authorizeVoiceWebhook','authorize','CRON_SECRET','verifyWebhook','getUser'].filter(x=>text.includes(x)),
  sensitiveReferences:['custom_prompt','admin_notes','extractedText','error.message','e.message'].filter(x=>text.includes(x))});
}}
walk(path.join(root,'src/app/api'));
const base=process.argv[2];
if(base){const target=new URL(base);if(target.protocol!=='http:'||!['127.0.0.1','localhost','[::1]'].includes(target.hostname))throw new Error('Runtime audits are restricted to the isolated loopback lab.');}
const runtime:Array<Record<string,unknown>>=[];
if(base)for(const route of routes)for(const method of route.methods)for(const credentials of ['anonymous','invalid']){
 const url=route.url.replace(/\[.*?\]/g,'00000000-0000-4000-8000-000000000001');
 try{
  const headers:Record<string,string>={...(credentials==='invalid'?{authorization:'Bearer synthetic-invalid-credential','x-cliste-voice-secret':'synthetic-invalid-credential'}:{})};
  if(['POST','PUT','PATCH'].includes(method))headers['Content-Type']='application/json';
  const response=await fetch(new URL(url,base),{method,headers,redirect:'manual',signal:AbortSignal.timeout(12_000),...(['POST','PUT','PATCH'].includes(method)?{body:'{}'}:{})});
  const text=await response.text();let keys:string[]=[];try{const value=JSON.parse(text);keys=value&&typeof value==='object'?Object.keys(value):[];}catch{}
  runtime.push({url,method,credentials,status:response.status,cacheControl:response.headers.get('cache-control'),keys,
   privateFieldLeak:/"(?:custom_prompt|admin_notes|service_role_key|api_secret)"\s*:|Set CLISTE_VOICE_WEBHOOK_SECRET|\.env\.local/.test(text),
   bytes:Buffer.byteLength(text)});
 }catch(error){runtime.push({url,method,failed:true,error:error instanceof Error?error.name:'unknown'});}
}
const result={routes,routeCount:routes.length,methodCount:routes.reduce((n,r)=>n+r.methods.length,0),runtime,
 failures:runtime.filter(r=>r.failed||r.privateFieldLeak||Number(r.status)>=500)};
const output=process.argv[3]??'/tmp/cara-browser-response-audit.json';writeFileSync(output,JSON.stringify(result,null,2));
console.log(JSON.stringify({routeCount:result.routeCount,methodCount:result.methodCount,requests:runtime.length,failures:result.failures,report:output},null,2));

}
void main().catch(error=>{console.error(error instanceof Error?error.message:"Audit failed");process.exitCode=1;});
