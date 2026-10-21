import '../../scripts/mock-server-only.ts';
import assert from 'node:assert/strict';
import test from 'node:test';
import {BUSINESS_CATEGORIES,SETUP_BUSINESS_CATEGORIES,parseBusinessClassification,type BusinessClassification} from './business-classification';
import {SERVICE_RECIPES,EXCLUDED_SETUP_SPECIALITIES} from './business-service-catalogue.data';
import {businessSetupIssue,offeredServicesScopeIssue} from './business-onboarding-scope';
import {classificationKey,starterServices,starterExtras,readStarterMetadata,newStarterMetadata,reconcileStarterServices,starterServiceKey,missingStarterProfiles,uniqueStarterServices} from './service-starter';
import {initialStarterDraft,changeStarterProfile,readStarterDraft,serviceEntry} from './service-starter-draft';
import {firstCallConfigPatch} from './first-call-config';
import {serviceSelectionIssue} from './service-selection';
import {firstServiceReview} from './service-entry-safety';
import {buildCaraSetupPromptInputFromOrg} from './cara-prompt-from-org';
import {compileCaraPrompt} from './compile-cara-prompt';
const salon:BusinessClassification={version:1,categoryId:'beauty',specialtyIds:['hair_salon']};
const dealer:BusinessClassification={version:1,categoryId:'automotive',specialtyIds:['vehicle_dealership']};
test('all 111 historical IDs are accounted for with exactly 92 active recipes and 19 excluded IDs',()=>{
 const all=BUSINESS_CATEGORIES.flatMap(c=>c.specialties.map(s=>s.id));
 assert.equal(all.length,111);assert.equal(Object.keys(SERVICE_RECIPES).length,92);assert.equal(Object.keys(EXCLUDED_SETUP_SPECIALITIES).length,19);
 assert.deepEqual([...all].sort(),[...Object.keys(SERVICE_RECIPES),...Object.keys(EXCLUDED_SETUP_SPECIALITIES)].sort());
 assert.equal(SETUP_BUSINESS_CATEGORIES.length,16);assert.equal(SETUP_BUSINESS_CATEGORIES.flatMap(c=>c.specialties).length,92);
});
test('historical excluded classifications remain readable but every new profile submission is rejected',()=>{
 for(const category of BUSINESS_CATEGORIES)for(const specialty of category.specialties.filter(s=>s.id in EXCLUDED_SETUP_SPECIALITIES)){
  const value={version:1 as const,categoryId:category.id,specialtyIds:[specialty.id]};
  assert.deepEqual(parseBusinessClassification(value),value);
  assert.ok(businessSetupIssue(value),specialty.id);
  assert.equal(firstCallConfigPatch('profile',{businessClassification:JSON.stringify(value)},'Test').ok,false,specialty.id);
  assert.deepEqual(starterServices(value),[]);assert.deepEqual(starterExtras(value),[]);
 }
});
test('Other cannot bypass the admission boundary and unknown IDs never receive recipes',()=>{
 assert.ok(businessSetupIssue({version:1,categoryId:'other',specialtyIds:['other_speciality']}));
 assert.ok(businessSetupIssue({version:1,categoryId:'trades',specialtyIds:['invented']}));
 assert.equal(parseBusinessClassification({version:1,categoryId:'trades',specialtyIds:['solicitor']}),null);
});
test('every catalogue default, profile and extra passes real service and scope validation',()=>{
 for(const [id,recipe] of Object.entries(SERVICE_RECIPES))for(const label of [...recipe.core,...recipe.extras,...(recipe.options??[]).flatMap(option=>option.services)]){
  assert.equal(serviceSelectionIssue(label,''),null,`${id}: ${label}`);
  assert.equal(offeredServicesScopeIssue([label]),null,`${id}: ${label}`);
  assert.equal(firstServiceReview([label],[]),null,`${id}: ${label}`);
 }
});
test('every supported recipe can save its combined profile draft without spelling or false duplicate prompts',()=>{
 for(const category of SETUP_BUSINESS_CATEGORIES)for(const specialty of category.specialties){
  if(specialty.id==='other_speciality')continue;
  const value:BusinessClassification={version:1,categoryId:category.id,specialtyIds:[specialty.id]},recipe=SERVICE_RECIPES[specialty.id];
  const profiles={[specialty.id]:(recipe.options??[]).map(option=>option.id)},services=starterServices(value,profiles);
  assert.ok(services.length,specialty.id);assert.equal(firstServiceReview(services,[]),null,specialty.id);
  const metadata={...newStarterMetadata(value),profiles};
  const result=firstCallConfigPatch('services',{services:services.join('\n'),serviceStarter:JSON.stringify(metadata)},'Test',value);
  assert.ok(result.ok,`${specialty.id}: ${!result.ok&&result.message}`);
 }
});
test('all same-category pairs merge all specialities; over-limit combinations are rejected rather than truncated',()=>{
 for(const category of SETUP_BUSINESS_CATEGORIES){
  const ids=category.specialties.filter(s=>s.id!=='other_speciality').map(s=>s.id);
  for(let i=0;i<ids.length;i++)for(let j=i+1;j<ids.length;j++){
   const value:BusinessClassification={version:1,categoryId:category.id,specialtyIds:[ids[i],ids[j]]};
   const profiles=Object.fromEntries(value.specialtyIds.map(id=>[id,(SERVICE_RECIPES[id].options??[]).map(option=>option.id)]));
   const result=starterServices(value,profiles);
   assert.deepEqual(result,uniqueStarterServices(value.specialtyIds.flatMap(id=>starterServices({...value,specialtyIds:[id]},profiles))));
   assert.equal(new Set(result.map(starterServiceKey)).size,result.length);
   if(result.length<=40&&result.join('\n').length<=2000)assert.equal(serviceSelectionIssue(result.join('\n'),''),null,ids[i]+' + '+ids[j]);
   else assert.ok(serviceSelectionIssue(result.join('\n'),''));
  }
 }
});
test('a salon starts with the requested editable basics and an empty exclusion list',()=>{
 const draft=initialStarterDraft({},salon);
 for(const label of ['Haircuts','Blow-dries','Root touch-ups','Balayage'])assert.ok(draft.banks.suggested.items.includes(label));
 assert.deepEqual(draft.notOffered.items,[]);assert.deepEqual(draft.banks.fresh.items,[]);
 assert.equal(draft.metadata.mode,'suggested');assert.ok(!draft.banks.suggested.items.includes('Extensions'));
});
test('sales-only dealers never acquire workshop services; combining profiles adds them only when selected',()=>{
 assert.deepEqual(starterServices(dealer,{vehicle_dealership:['sales']}),['Vehicle sales']);
 assert.ok(!starterServices(dealer,{vehicle_dealership:['sales']}).includes('Brake repairs'));
 assert.ok(starterServices(dealer,{vehicle_dealership:['sales','workshop']}).includes('Brake repairs'));
 assert.deepEqual(missingStarterProfiles(dealer,{}),['Vehicle dealership']);
});
test('saved lists reopen exactly and are never automatically regenerated',()=>{
 const original={services:'Bespoke hair styling',notOffered:'Extensions',servicesConfigured:'true'};
 const draft=initialStarterDraft(original,salon);assert.equal(draft.metadata.mode,'fresh');assert.deepEqual(draft.banks.fresh.items,['Bespoke hair styling']);assert.deepEqual(draft.notOffered.items,['Extensions']);
});
test('profiles preserve custom services and persistent removals across repeated changes',()=>{
 let draft=initialStarterDraft({},dealer);
 draft=changeStarterProfile(draft,dealer,'vehicle_dealership','sales');
 draft.banks.suggested.items.push('Vehicle sourcing');
 draft.metadata.removed.push('vehicle sales');draft.banks.suggested.items=draft.banks.suggested.items.filter(x=>x!=='Vehicle sales');
 draft=changeStarterProfile(draft,dealer,'vehicle_dealership','workshop');
 assert.ok(draft.banks.suggested.items.includes('Vehicle sourcing'));assert.ok(draft.banks.suggested.items.includes('Brake repairs'));assert.ok(!draft.banks.suggested.items.includes('Vehicle sales'));
 draft=changeStarterProfile(draft,dealer,'vehicle_dealership','workshop');assert.deepEqual(draft.banks.suggested.items,['Vehicle sourcing']);
});
test('mode banks and unfinished entries survive a bounded local-draft round trip',()=>{
 const draft=initialStarterDraft({},salon);draft.banks.fresh=serviceEntry(['Custom styling']);draft.banks.fresh.draft='Bridal hair';draft.metadata.mode='fresh';draft.notOffered=serviceEntry(['Extensions']);
 assert.deepEqual(readStarterDraft(JSON.stringify(draft),salon),draft);
 assert.equal(readStarterDraft(JSON.stringify(draft),dealer),null);
 for(const raw of ['{','{}',JSON.stringify({...draft,banks:{fresh:{items:[],draft:5,editing:null}}}),'a'.repeat(30001)])assert.equal(readStarterDraft(raw,salon),null);
});
test('invalid metadata cannot invent profiles, versions or extra classifications',()=>{
 const valid=newStarterMetadata(dealer);
 for(const value of [{...valid,version:2},{...valid,catalogueVersion:2},{...valid,classificationKey:'health:pharmacy'},{...valid,profiles:{vehicle_dealership:['invented']}},{...valid,profiles:{solicitor:['wills']}},{...valid,removed:[3]}])assert.equal(readStarterMetadata(value,dealer),null);
 assert.equal(readStarterMetadata(valid,dealer)?.classificationKey,classificationKey(dealer));
});
test('template reconciliation keeps scopes distinct and aliases do not duplicate the same service',()=>{
 assert.deepEqual(uniqueStarterServices(['Haircuts','Hair cuts','Car hire','Van hire','Gas boiler servicing','Oil boiler servicing']),['Haircuts','Car hire','Van hire','Gas boiler servicing','Oil boiler servicing']);
 assert.deepEqual(reconcileStarterServices(['Custom styling','Haircuts'],['Haircuts'],['Haircuts','Blow-dries'],['blow-dries']),['Custom styling','Haircuts']);
});
test('fresh mode permits custom services but never excluded clinical/legal/financial activity',()=>{
 const metadata={...newStarterMetadata(dealer),mode:'fresh' as const};
 assert.ok(firstCallConfigPatch('services',{services:'Vehicle sourcing',serviceStarter:JSON.stringify(metadata)},'Test',dealer).ok);
 for(const services of ['Clinical Pilates','Botox treatments','Medical consultations','Tax advice','Psychotherapy','Hazardous waste collection','Mortgage advice','Massage'])assert.equal(firstCallConfigPatch('services',{services,serviceStarter:JSON.stringify(metadata)},'Test',dealer).ok,false,services);
 // Exclusions describe a refusal rather than an offered capability.
 assert.ok(firstCallConfigPatch('services',{services:'Haircuts',notOffered:'Massage'},'Test',salon).ok);
});
test('malformed profiles and unfinished required profile choices fail before saving',()=>{
 for(const serviceStarter of ['{',JSON.stringify(newStarterMetadata(dealer))])assert.equal(firstCallConfigPatch('services',{services:'Vehicle sales',serviceStarter},'Test',dealer).ok,false);
});
test('only successfully confirmed services enter Cara instructions; starter metadata and extras do not',()=>{
 const input=buildCaraSetupPromptInputFromOrg({name:'Test salon',niche:'hair_salon',business_classification:salon,agent_services_departments:'Haircuts\nBlow-dries',agent_services_not_offered:'Hair extensions',service_starter_state:{...newStarterMetadata(salon),removed:['balayage']}});
 const prompt=compileCaraPrompt(input);
 assert.match(prompt,/Haircuts/);assert.match(prompt,/Blow-dries/);assert.match(prompt,/Hair extensions/);
 assert.ok(!prompt.includes('Balayage'));assert.ok(!prompt.includes('Keratin smoothing'));assert.ok(!prompt.includes('catalogueVersion'));
});

test('corrupted cached duplicates cannot leave an out-of-range edit target',()=>{
 const draft=initialStarterDraft({},salon);
 draft.banks.suggested={items:['Haircuts','Haircuts'],draft:'New label',editing:1};
 assert.equal(readStarterDraft(JSON.stringify(draft),salon),null);
});

test('changing specialities preserves confirmed services and earlier explicit template removals',()=>{
 const metadata={...newStarterMetadata(salon),removed:['balayage']};
 const expanded:BusinessClassification={...salon,specialtyIds:['hair_salon','nail_salon']};
 const draft=initialStarterDraft({services:'Haircuts',serviceStarter:JSON.stringify(metadata)},expanded);
 assert.equal(draft.metadata.mode,'fresh');assert.deepEqual(draft.banks.fresh.items,['Haircuts']);
 assert.ok(draft.metadata.removed.includes('balayage'));assert.ok(!draft.banks.suggested.items.includes('Balayage'));
});
