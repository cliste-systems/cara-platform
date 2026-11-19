"use client";
import {useCallback,useEffect,useId,useLayoutEffect,useRef,useState} from "react";
import {useSetupDraft,type RememberSetupDraft} from "./use-setup-draft";
import interactions from "@/components/onboarding/signup-interactions.module.css";
import styles from "./setup-business-step.module.css";
import {motion,useReducedMotion} from "motion/react";
import {SetupCountySelect} from "./setup-county-select";
import {ArrowRight} from "lucide-react";
import {normalizeBusinessWebsite} from "@/lib/first-call-setup";
import {useSetupValidation} from "./use-setup-validation";
import type {FirstCallSetupState} from "@/lib/first-call-setup";
const field = styles.input;
const primary = `${styles.primary} ${interactions.primary}`;
export type BusinessVerificationNavigation = {back:()=>void} | null;
export function FirstCallBusinessForm({state:s,pending,onSubmit,onNavigation,onDraft,draftVersion="",initialPage=0,authorityChecked=false}:{onDraft?:RememberSetupDraft;draftVersion?:string;initialPage?:number;authorityChecked?:boolean;state:FirstCallSetupState;pending:boolean;onSubmit:(form:FormData)=>void;onNavigation?:(navigation:BusinessVerificationNavigation)=>void}){
 const reduced=useReducedMotion(),formId=useId();
 const [withoutWebsite,setWithoutWebsite]=useState(s.details.websiteStatus==="not_available");
 const validation=useSetupValidation({website:value=>withoutWebsite||normalizeBusinessWebsite(value)?undefined:"Enter a website like yourbusiness.ie — no https:// needed."});
 const d=s.details,[page,setPage]=useState(Math.min(2,Math.max(0,initialPage))),[type,setType]=useState(d.businessType??"company");const ref=useRef<HTMLFormElement>(null);
 const [county,setCounty]=useState(d.county??""),[countyError,setCountyError]=useState(false);
 const countyId=`${formId}-county`;
 const fieldsetRef=useRef<HTMLFieldSetElement>(null);
 const [panelHeight,setPanelHeight]=useState<number>();
 useLayoutEffect(()=>{
  const element=fieldsetRef.current;
  if(!element)return;
  const observer=new ResizeObserver(()=>setPanelHeight(element.getBoundingClientRect().height));
  observer.observe(element);
  return ()=>observer.disconnect();
 },[]);
 useSetupDraft(ref,"business",draftVersion,onDraft);
 const back=useCallback(()=>setPage(value=>Math.max(0,value-1)),[]);
 useEffect(()=>{onNavigation?.(page>0?{back}:null);return ()=>onNavigation?.(null);},[page,back,onNavigation]);
 function validatePart(root:HTMLElement){
  const fieldsValid=validation.validate(root);
  const needsCounty=page===1||root===ref.current;
  if(needsCounty)setCountyError(!county);
  if(needsCounty&&!county){
   if(fieldsValid)requestAnimationFrame(()=>{const trigger=document.getElementById(countyId);trigger?.focus({preventScroll:true});trigger?.scrollIntoView({block:"center",behavior:reduced?"instant":"smooth"});});
   return false;
  }
  return fieldsValid;
 }
 function next(){const part=ref.current?.querySelector<HTMLElement>(`[data-part="${page}"]`);if(part&&validatePart(part))setPage(v=>Math.min(2,v+1));}
 return <form id={formId} data-setup-business-form noValidate ref={ref} onChange={e=>{if(e.target instanceof HTMLInputElement||e.target instanceof HTMLTextAreaElement)validation.clear(e.target.name);}} method="post" onSubmit={e=>{e.preventDefault();if(page<2){next();return;}if(validatePart(e.currentTarget))onSubmit(new FormData(e.currentTarget));}} className={styles.form}><input type="hidden" name="draftPage" value={page}/>
 <div className={styles.fields}><ol className={styles.parts} aria-label="Business verification sections">{["Business","Address","Contact"].map((v,i)=><li key={v} aria-current={page===i?"step":undefined}><span>{String(i+1).padStart(2,"0")}</span>{v}</li>)}</ol>
 <motion.div initial={false} animate={{height:panelHeight??"auto"}} transition={{duration:reduced?0:.28,ease:[.22,1,.36,1]}}><fieldset ref={fieldsetRef} disabled={pending} className={styles.fieldset}>
 <motion.div data-part="0" hidden={page!==0} inert={page!==0} aria-hidden={page!==0} className={styles.part}><fieldset><legend className={styles.legend}>Business type</legend><div className={styles.types}>{[["company","Registered company"],["sole_trader","Sole trader"]].map(([value,label])=><label key={value} className={styles.type}><input name="businessType" type="radio" value={value} checked={type===value} onChange={()=>{setType(value as "company"|"sole_trader");validation.clear("registrationNumber");}} className={styles.radio}/>{label}</label>)}</div></fieldset><div className={styles.grid}><label className={`${styles.field} signup-account-field`}>Legal business name<input name="legalName" {...validation.props("legalName")} required minLength={2} maxLength={200} defaultValue={d.legalName??s.legalName} className={field}/>{validation.error("legalName")}</label><label hidden={type!=="company"} className={`${styles.field} signup-account-field`}>Company registration number<input name="registrationNumber" {...validation.props("registrationNumber")} disabled={type!=="company"} required={type==="company"} maxLength={80} defaultValue={d.registrationNumber} className={field}/>{validation.error("registrationNumber")}</label></div><label className={`${styles.field} signup-account-field`}>Business website<input name="website" {...validation.props("website")} disabled={withoutWebsite} required={!withoutWebsite} type="text" inputMode="url" autoComplete="url" maxLength={500} defaultValue={d.website} placeholder="yourbusiness.ie" className={field}/>{validation.error("website")}</label><input type="hidden" name="websiteStatus" value={withoutWebsite?"not_available":"provided"}/><label className="flex cursor-pointer items-center gap-2 text-sm text-[#353D42]"><input type="checkbox" checked={withoutWebsite} onChange={e=>{setWithoutWebsite(e.target.checked);validation.clear("website");}} className={styles.radio}/>I don’t have a website</label>{withoutWebsite&&<p className={styles.note}>Our team can review your business without a website.</p>}</motion.div>
 <motion.div data-part="1" hidden={page!==1} inert={page!==1} aria-hidden={page!==1} className={styles.part}><label className={`${styles.field} signup-account-field`}>Address line 1<input name="addressLine1" {...validation.props("addressLine1")} required minLength={3} maxLength={300} autoComplete="address-line1" defaultValue={d.addressLine1??d.address} placeholder="Building number and street" className={field}/>{validation.error("addressLine1")}</label>
 <label className={`${styles.field} signup-account-field`}>Address line 2 <span className={styles.optional}>(optional)</span><input name="addressLine2" {...validation.props("addressLine2")} maxLength={300} autoComplete="address-line2" defaultValue={d.addressLine2} placeholder="Unit, building or locality" className={field}/>{validation.error("addressLine2")}</label>
 <div className={styles.grid}><label className={`${styles.field} signup-account-field`}>Town / city<input name="town" {...validation.props("town")} required minLength={2} maxLength={100} autoComplete="address-level2" defaultValue={d.town} className={field}/>{validation.error("town")}</label><SetupCountySelect id={countyId} value={county} onChange={value=>{setCounty(value);setCountyError(false);}} error={countyError}/></div>
 <label className={`${styles.field} signup-account-field`}>Eircode<input name="eircode" {...validation.props("eircode")} required pattern="[A-Za-z][0-9A-Za-z]{2} ?[0-9A-Za-z]{4}" maxLength={8} autoComplete="postal-code" defaultValue={d.eircode} placeholder="D02 X285" className={field}/>{validation.error("eircode")}</label></motion.div>
 <motion.div data-part="2" hidden={page!==2} inert={page!==2} aria-hidden={page!==2} className={styles.part}><label className={`${styles.field} signup-account-field`}>Authorised contact name<input name="representative" {...validation.props("representative")} required minLength={2} maxLength={200} defaultValue={d.representative} className={field}/>{validation.error("representative")}</label><label className={`${styles.field} signup-account-field`}>Contact email<input name="email" {...validation.props("email")} type="email" required maxLength={254} defaultValue={d.email??s.email} className={field}/>{validation.error("email")}</label><div data-legal-acceptance className={styles.consentBox}><label data-setup-consent className={styles.consent}><input name="authority" {...validation.props("authority")} defaultChecked={authorityChecked} required type="checkbox" className={styles.radio}/><span className="min-w-0 flex-1">I am authorised to provide these details for phone-number verification and confirm they are accurate.</span></label><div>{validation.error("authority")}</div></div><p className={styles.note}>Our team will review these details separately. Continue setup to get Cara ready for calls.</p></motion.div>
 </fieldset></motion.div></div>
 <div className={styles.actions}>{page<2?<button key="next" type="button" disabled={pending} onClick={next} className={primary}>Continue<ArrowRight size={16}/></button>:<button form={formId} key="submit" disabled={pending} type="submit" className={primary}>{pending?"Submitting…":"Submit & continue"}<ArrowRight size={16}/></button>}</div>
 </form>;
}
