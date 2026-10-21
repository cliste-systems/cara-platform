import CustomerSetupPreview from "@/app/(admin)/admin/customers/[orgId]/setup-preview/page";
export const dynamic="force-dynamic";
export default function WelcomePreview({params}:{params:Promise<{orgId:string}>}) {
 return <CustomerSetupPreview params={params} searchParams={Promise.resolve({screen:"confirmation"})}/>;
}
