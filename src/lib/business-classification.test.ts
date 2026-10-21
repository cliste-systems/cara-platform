import '../../scripts/mock-server-only.ts';
import assert from 'node:assert/strict';
import test from 'node:test';
import {BUSINESS_CATEGORIES,parseBusinessClassification,classificationNiche,classificationServiceSuggestions,businessScopeGuidance} from './business-classification';
import {firstCallConfigPatch} from './first-call-config';
import {buildCaraSetupPromptInputFromOrg} from './cara-prompt-from-org';
import {compileCaraPrompt} from './compile-cara-prompt';
const electrician={version:1 as const,categoryId:'trades',specialtyIds:['electrician']};
test('the catalogue has unique stable IDs and excludes all retail self-service',()=>{
 assert.equal(new Set(BUSINESS_CATEGORIES.map(c=>c.id)).size,BUSINESS_CATEGORIES.length);
 for(const c of BUSINESS_CATEGORIES){assert.notEqual(c.niche,'retail');assert.ok(c.specialties.length);assert.equal(new Set(c.specialties.map(s=>s.id)).size,c.specialties.length);for(const s of c.specialties)assert.notEqual(s.legacyNiche,'retail');}
 assert.equal(parseBusinessClassification({version:1,categoryId:'retail',specialtyIds:['supermarket']}),null);
 assert.equal(parseBusinessClassification({version:1,categoryId:'ecommerce',specialtyIds:['online_shop']}),null);
});
test('server validation rejects wrong parent, unknown versions, unknown/duplicate IDs and excessive selections',()=>{
 for(const value of [{...electrician,version:2},{...electrician,categoryId:'beauty'},{...electrician,specialtyIds:['invented']},{...electrician,specialtyIds:['electrician','electrician']},{...electrician,specialtyIds:[]},{...electrician,specialtyIds:Array(9).fill('electrician')},'Electrician'])assert.equal(parseBusinessClassification(value),null);
});
test('self-service classification uses the general workspace while multiple trades are retained',()=>{
 assert.deepEqual(parseBusinessClassification({...electrician,specialtyIds:['electrician','plumber']}),{...electrician,specialtyIds:['electrician','plumber']});
 for(const category of BUSINESS_CATEGORIES)for(const speciality of category.specialties)assert.equal(classificationNiche({version:1,categoryId:category.id,specialtyIds:[speciality.id]}),'other');
});
test('selecting electrician saves classification without inventing confirmed services or requiring prose',()=>{
 const result=firstCallConfigPatch('profile',{businessClassification:JSON.stringify(electrician),description:''},'Example');assert.ok(result.ok);
 assert.equal(result.patch.niche,'other');assert.deepEqual(result.patch.business_classification,electrician);
 assert.equal(result.patch.agent_business_type,'Electrician');assert.equal(result.patch.raw_business_description,null);
 assert.equal(result.patch.agent_services_departments,undefined);assert.equal(result.patch.is_active,undefined);
 assert.ok(classificationServiceSuggestions(electrician).includes('Rewiring'));
});
test('contradictory confirmed service selections are rejected',()=>assert.equal(firstCallConfigPatch('services',{services:'Rewiring',notOffered:'rewiring'},'Example').ok,false));
test('saved classification reaches the compiled live prompt with boundaries and explicit-service precedence',()=>{
 const input=buildCaraSetupPromptInputFromOrg({name:'Example',business_classification: electrician,agent_business_type:'Electrician',agent_services_departments:'Electrical repairs'});
 assert.equal(input.businessScope,businessScopeGuidance(electrician));
 const prompt=compileCaraPrompt(input);
 assert.match(prompt,/BUSINESS SCOPE.*Trades & construction → Electrician/);
 assert.match(prompt,/clearly unrelated work unless the business explicitly lists it as offered/);
 assert.match(prompt,/plausible but unconfirmed service/);
 assert.match(prompt,/Never infer prices, qualifications, certification, availability, emergency cover/);
});
test('legacy and team-managed retail prompts receive no classification assumptions',()=>{
 assert.equal(buildCaraSetupPromptInputFromOrg({niche:'retail',name:'Example shop',business_classification:electrician}).businessScope,undefined);
 assert.equal(businessScopeGuidance({categoryId:'trades',specialtyIds:['electrician']}),undefined);
});
