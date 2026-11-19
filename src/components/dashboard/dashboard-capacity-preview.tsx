"use client";

import type { DashboardHomeSnapshot } from "@/lib/dashboard-home-snapshot";
import { ServiceBusinessOverview } from "./service-business-overview";

const names=["Emma Walsh","Daniel Murphy","Sophie Carter","Liam O’Brien","Aoife Byrne"];
const reasons=["Callback requested about a consultation next week","Checking Saturday availability for two appointments","Asked about pricing and your cancellation policy","Needs to rearrange an existing booking","Opening hours and parking information"];
const questions=["Do you offer gift vouchers, and can customers buy them over the phone?","Is parking available nearby for customers with limited mobility?","Can two people book appointments together on a Saturday?","What is your cancellation policy for appointments booked at short notice?"];

export function DashboardCapacityPreview({snapshot}:{snapshot:DashboardHomeSnapshot}) {
 const sample:DashboardHomeSnapshot={...snapshot,error:null,stats:[{label:"Calls answered",value:"48",href:"/dashboard/calls"}],openActions:12,openTrainingCount:4,callMinutes:126,averageCallSeconds:158,metricPeriod:"today",
  needsAttention:names.slice(0,4).map((title,i)=>({id:`sample-followup-${i}`,href:"/dashboard/calls?filter=follow_up",title,description:reasons[i],time:`${14+i}:10`})),
  caraTraining:questions.map((title,i)=>({id:`sample-question-${i}`,href:"/dashboard/cara-knowledge?tab=needs-input",title,description:"Sample question for layout testing",time:"Today"})),
  activity:names.map((title,i)=>({id:`sample-call-${i}`,href:"/dashboard/calls",title,subtitle:reasons[i],time:`${17-i}:${i%2?"42":"15"}`})),
  callTimes:[2,3,5,4,7,8,6,5,4,3,1].map((value,i)=>({id:`sample-hour-${i}`,label:`${8+i}:00`,value})),
 };
 return <ServiceBusinessOverview snapshot={sample} refreshError={null} onRetry={()=>{}}/>;
}
