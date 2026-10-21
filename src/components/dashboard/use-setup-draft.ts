"use client";

import {useLayoutEffect,type RefObject} from "react";

export type RememberSetupDraft=(section:string,version:string,values:Record<string,string>)=>void;
/** Read the last committed form DOM before a section unmounts, without saving it remotely. */
export function useSetupDraft(ref:RefObject<HTMLFormElement|null>,section:string,version:string,onDraft?:RememberSetupDraft){
 useLayoutEffect(()=>{
  const form=ref.current;
  return ()=>{if(form&&onDraft)onDraft(section,version,Object.fromEntries([...new FormData(form).entries()].map(([name,value])=>[name,String(value)])));};
 },[ref,section,version,onDraft]);
}
