"use client";
import Link from "next/link";
import { ArrowRight, Check, CircleAlert, Clock3, Phone } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { needsProviderAssistance, type PhoneConnection } from "@/lib/phone-connection";
import styles from "./phone-line-dialog.module.css";
export type PhoneLineState = "operational" | "degraded" | "outage" | "setup" | "unknown";
const copy = {
 unknown: { label: "Status unavailable", title: "We couldn’t check service status.", description: "Please try again shortly. This does not confirm a service disruption.", detail: "Not verified" },
 operational: { label: "Connection verified", title: "Your connection has been verified.", description: "A previous test confirmed your forwarding setup. Make a test call to check the current connection.", detail: "Setup verified" },
 degraded: { label: "Partly affected", title: "Some calls may be affected.", description: "You may experience delays connecting incoming calls.", detail: "Connection delays" },
 outage: { label: "Service outage", title: "Incoming calls are disrupted.", description: "Cara is currently unable to receive calls on your line.", detail: "Service interrupted" },
 setup: { label: "Setup pending", title: "Let’s connect your phone line.", description: "Complete call forwarding with your network to let Cara receive incoming calls.", detail: "Awaiting activation" },
};
export function PhoneLineDialog({open,onOpenChange,state,incidentUpdate,connection,kind="phone"}:{kind?:"phone"|"services";connection?:PhoneConnection|null;open:boolean;onOpenChange:(open:boolean)=>void;state:PhoneLineState;incidentUpdate?:string}) {
 const setupCopy = connection?.support_ticket_id
  ? { title: "We’re helping you get connected.", description: "Your setup request is saved. We’ll reply in Support in your dashboard.", detail: "Help requested", action: "View support request", href: "/dashboard/support" }
  : connection && needsProviderAssistance(connection.phone_type, connection.provider)
  ? { title: "Your network needs to enable forwarding.", description: "View the forwarding request to share with your network. Your setup details are saved.", detail: "Provider action needed", action: "View next steps", href: "/dashboard/settings/phone-setup" }
  : connection
  ? { title: "Let’s check your connection.", description: "Make a test call to confirm incoming calls reach Cara. Your phone settings are saved.", detail: "Test call needed", action: "Check connection", href: "/dashboard/settings/phone-setup" }
  : { title: "Finish connecting your phone line.", description: "Continue setting up call forwarding when you’re ready. Cara can receive calls once your line is connected.", detail: "Setup incomplete", action: "Continue setup", href: "/dashboard/settings/phone-setup" };
 const serviceCopy = state === "unknown" ? copy.unknown : state === "operational"
 ? {label:"Operational",title:"Provider services report normal operation.",description:"The latest public provider reports show normal operation. Make a test call to verify your own connection.",detail:"Working normally"}
 : state === "outage"
 ? {title:"We’re experiencing a service outage.",description:"Some features are currently unavailable.",detail:"Service interrupted"}
 : {title:"Some services are affected.",description:"Certain features may be slower or temporarily unavailable.",detail:"Partly affected"};
 const content=kind === "services" ? {...copy[state],...serviceCopy} : state === "setup" ? {...copy.setup,...setupCopy} : copy[state];
 const Icon=state==="operational"?Check:state==="setup"?Clock3:CircleAlert;
 return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className={`${styles.popup} ${kind === "services" ? styles.services : ""}`} overlayClassName={styles.backdrop}>
  <span className={styles.handle} aria-hidden="true"/>
  <div className={styles.art} aria-hidden="true"/>
  <DialogTitle className={styles.title}>{kind === "services" ? "Cara services" : "Phone line"}</DialogTitle>
  <div className={styles.body} data-state={state}>
   <div className={styles.status}><span className={styles.dot}/>{content.label}<span className={styles.bars} aria-hidden="true">{[1,2,3,4,5].map(n=><i key={n} style={{height:`${n*20}%`}} data-lit={n<=(state==="operational"?5:state==="degraded"?3:1)}/>)}</span></div>
   <h2>{content.title}</h2><DialogDescription className={styles.description}>{content.description}</DialogDescription>
   <div className={styles.detail}><Phone aria-hidden="true"/><span>{kind === "services" ? "Cara services" : state==="setup"?"Call forwarding":"Incoming calls"}</span><strong>{content.detail}</strong><Icon aria-hidden="true"/></div>
   {incidentUpdate&&<p className={styles.update}>{incidentUpdate}</p>}
   
   <Link className={styles.cta} href={state==="setup"?setupCopy.href:"/dashboard/support"} onClick={()=>onOpenChange(false)}>{state==="setup"?setupCopy.action:"Contact support"}<ArrowRight aria-hidden="true"/></Link>
   {<Link className={`${styles.cta} ${styles.report}`} href="/dashboard/support" onClick={()=>onOpenChange(false)}>Report issue<CircleAlert aria-hidden="true"/></Link>}
   {state==="setup"&&!connection?.support_ticket_id&&<Link className={styles.support} href="/dashboard/support" onClick={()=>onOpenChange(false)}>Need a hand? Contact support</Link>}
  </div>
 </DialogContent></Dialog>;
}
