import { NextResponse } from "next/server";

import { requireAdminPermission } from "@/lib/admin-session";
import {
  generateRetailDiscoveryDrafts,
  type RetailDiscoveryBatchCount,
} from "@/lib/retail-regression-discovery";
import {
  createRetailDiscoveryScenarios,
  promoteRetailDiscoveryScenario,
} from "@/lib/retail-regression-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body =
  | {
      action: "generate";
      calledNumber?: string;
      count?: number;
      batchIndex?: number;
    }
  | {
      action: "promote";
      calledNumber?: string;
      scenarioId?: string;
    };

const ALLOWED_BATCH_COUNTS = new Set<RetailDiscoveryBatchCount>([10, 15, 20, 25]);

export async function POST(request: Request) {
  try {
    await requireAdminPermission("calls");
  } catch {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  try {
    if (body.action === "generate") {
      const calledNumber = String(body.calledNumber ?? "").trim();
      const count = Number(body.count ?? 25) as RetailDiscoveryBatchCount;
      const batchIndex = Math.max(1, Math.trunc(Number(body.batchIndex ?? 1)));

      if (!calledNumber) {
        return NextResponse.json(
          { error: "calledNumber is required." },
          { status: 400 },
        );
      }
      if (!ALLOWED_BATCH_COUNTS.has(count)) {
        return NextResponse.json(
          { error: "count must be 10, 15, 20, or 25." },
          { status: 400 },
        );
      }

      const drafts = await generateRetailDiscoveryDrafts({
        count,
        batchIndex,
      });
      const scenarios = await createRetailDiscoveryScenarios({
        calledNumber,
        drafts,
      });

      return NextResponse.json({ scenarios });
    }

    if (body.action === "promote") {
      const calledNumber = String(body.calledNumber ?? "").trim();
      const scenarioId = String(body.scenarioId ?? "").trim();
      if (!calledNumber || !scenarioId) {
        return NextResponse.json(
          { error: "calledNumber and scenarioId are required." },
          { status: 400 },
        );
      }

      const scenario = await promoteRetailDiscoveryScenario({
        calledNumber,
        scenarioId,
      });
      return NextResponse.json({ scenario });
    }

    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Discovery operation failed.";
    const status = message.includes("not configured") ? 503 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
