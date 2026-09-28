"use server";

import { revalidatePath } from "next/cache";

import {
  deleteBusinessFileForOrg,
  listBusinessFilesForOrg,
  listSendableBusinessFilesForOrg,
  updateBusinessFileMetadataForOrg,
  updateBusinessFileTogglesForOrg,
  uploadBusinessFileForOrg,
} from "@/lib/business-files-server";
import {
  isBusinessFileKind,
  type BusinessFileKind,
  type BusinessFileListItem,
} from "@/lib/business-files";
import { regenerateCaraCustomPrompt } from "@/lib/cara-prompt-from-org";
import { AGENT_CONFIG_REVALIDATE_PATHS } from "@/lib/dashboard-routes";
import { requireDashboardSession } from "@/lib/dashboard-session";
import { requireDashboardAdmin } from "@/lib/dashboard-admin";
import { listServicesForOrg } from "@/lib/service-catalog";

import { parseAgentFaqs } from "./agent-faqs";

type ActionResult = { ok: true } | { ok: false; message: string };

function revalidateBusinessFilesPaths() {
  for (const path of AGENT_CONFIG_REVALIDATE_PATHS) {
    revalidatePath(path);
  }
  revalidatePath("/dashboard/routing");
  revalidatePath("/onboarding/knowledge");
}

export async function listBusinessFiles(): Promise<BusinessFileListItem[]> {
  const { supabase, organizationId } = await requireDashboardSession();
  return listBusinessFilesForOrg(supabase, organizationId);
}

export async function listSendableBusinessFiles(): Promise<BusinessFileListItem[]> {
  const { supabase, organizationId } = await requireDashboardSession();
  return listSendableBusinessFilesForOrg(supabase, organizationId);
}

export async function uploadBusinessFile(
  formData: FormData,
): Promise<
  ActionResult & { file?: BusinessFileListItem; overlapSendOnlyDefault?: boolean }
> {
  const { organizationId, supabase } = await requireDashboardAdmin();
  const file = formData.get("file");
  const rawKind = String(formData.get("documentKind") ?? "").trim();
  const documentKind = isBusinessFileKind(rawKind) ? rawKind : null;

  if (!(file instanceof File)) {
    return { ok: false, message: "Choose a file to upload." };
  }
  if (!documentKind) {
    return { ok: false, message: "Choose a document type before uploading." };
  }

  const [{ data: org }, serviceCatalog] = await Promise.all([
    supabase
      .from("organizations")
      .select("agent_faqs")
      .eq("id", organizationId)
      .maybeSingle(),
    listServicesForOrg(supabase, organizationId),
  ]);

  const faqs = parseAgentFaqs(org?.agent_faqs);
  const hasServiceCatalog = serviceCatalog.length > 0;
  const hasFaqs = faqs.some(
    (faq) => faq.question.trim() && faq.answer.trim(),
  );

  const result = await uploadBusinessFileForOrg({
    organizationId,
    file,
    documentKind,
    hasServiceCatalog,
    hasFaqs,
  });

  if (result.ok) {
    await regenerateCaraCustomPrompt(supabase, organizationId);
    revalidateBusinessFilesPaths();
  }

  return result;
}

export async function updateBusinessFileToggles(
  fileId: string,
  patch: { answerEnabled?: boolean; sendEnabled?: boolean },
): Promise<ActionResult> {
  const { supabase, organizationId } = await requireDashboardAdmin();
  const result = await updateBusinessFileTogglesForOrg(
    supabase,
    organizationId,
    fileId,
    patch,
  );
  if (result.ok) {
    await regenerateCaraCustomPrompt(supabase, organizationId);
    revalidateBusinessFilesPaths();
  }
  return result;
}

export async function updateBusinessFileMetadata(
  fileId: string,
  patch: {
    title: string;
    documentKind: BusinessFileKind;
    caraDescription?: string;
    whenToUse?: string;
  },
): Promise<ActionResult & { file?: BusinessFileListItem }> {
  const { supabase, organizationId } = await requireDashboardAdmin();
  const result = await updateBusinessFileMetadataForOrg(
    supabase,
    organizationId,
    fileId,
    patch,
  );
  if (result.ok) {
    await regenerateCaraCustomPrompt(supabase, organizationId);
    revalidateBusinessFilesPaths();
  }
  return result;
}

export async function deleteBusinessFile(fileId: string): Promise<ActionResult> {
  const { supabase, organizationId } = await requireDashboardAdmin();
  const result = await deleteBusinessFileForOrg(
    supabase,
    organizationId,
    fileId,
  );
  if (result.ok) {
    await regenerateCaraCustomPrompt(supabase, organizationId);
    revalidateBusinessFilesPaths();
  }
  return result;
}
