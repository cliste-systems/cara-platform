import {firstCallSteps, firstCallSetupComplete, type FirstCallSetupState} from './first-call-setup';

/** Browser navigation is a hint only; server-backed completion always controls access. */
export function firstCallResumeStep(state: FirstCallSetupState, preferred?: string | null): string | null {
 const steps=firstCallSteps(state);
 if(firstCallSetupComplete(state))return 'forwarding';
 const chosen=steps.find(step=>step.id===preferred&&step.unlocked&&!step.complete);
 if(chosen)return chosen.id;
 const started=state.verificationStatus!=='not_submitted'||Object.keys(state.completedSections??{}).length>0;
 if(!started&&!preferred)return null;
 return (steps.find(step=>step.unlocked&&!step.complete&&!(step.id==='business'&&state.verificationStatus==='submitted'))??steps.find(step=>step.unlocked&&!step.complete))?.id??null;
}
export function readFirstCallCursor(raw: string | null): string | null {
 if(!raw||raw.length>500)return null;
 try {
  const value=JSON.parse(raw);
  return value?.version===1&&['email','business','profile','hours','services','greeting','test','forwarding'].includes(value.step)?value.step==='services'?'greeting':value.step:null;
 }catch{return null;}
}

/** Resume the next unfinished configuration section. */
export function firstCallConfigurationStep(state: FirstCallSetupState): string | null {
 return firstCallSteps(state).find(step=>['profile','hours','greeting'].includes(step.id)&&step.unlocked&&!step.complete)?.id??null;
}

