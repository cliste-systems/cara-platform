import {requireAdminPermission} from "@/lib/admin-session";
import {PlanPicker} from "@/app/(onboarding)/onboarding/plan/plan-picker";
import {OnboardingStepShell} from "@/components/onboarding/onboarding-step-shell";
import {PLANS,PLATFORM_TRIAL_DAYS} from "@/lib/cliste-plans";
export const dynamic="force-dynamic";
export default async function PlanPreview({params}:{params:Promise<{orgId:string}>}) {
 await requireAdminPermission("customers");
 const {orgId}=await params;
 return <OnboardingStepShell variant="plan" compact title="Choose your plan" description={`${PLATFORM_TRIAL_DAYS} days free, then monthly billing. Card required. Cancel anytime.`}><PlanPicker plans={Object.values(PLANS).filter(p=>p.selfServe).map(p=>({...p,recommended:Boolean(p.recommended)}))} configureAfterCheckout defaultPlan="pro" defaultInterval="month" previewCheckoutPath={`/preview/signup/${orgId}/checkout`}/></OnboardingStepShell>;
}
