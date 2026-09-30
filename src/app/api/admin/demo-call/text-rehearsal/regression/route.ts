import { NextResponse } from "next/server";

import { requireAdminPermission } from "@/lib/admin-session";
import {
  finishRetailRegressionRun,
  loadRetailRegressionSuite,
  recordRetailRegressionResult,
  seedRetailRegressionScenarios,
  startRetailRegressionRun,
} from "@/lib/retail-regression-store";
import type {
  RetailRegressionExecution,
  RetailRegressionGrade,
} from "@/lib/retail-regression";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function requireAdmin() {
  try {
    await requireAdminPermission("calls");
    return null;
  } catch {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
}

export async function GET(request: Request) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  const url = new URL(request.url);
  const calledNumber = url.searchParams.get("calledNumber")?.trim() ?? "";
  if (!calledNumber) {
    return NextResponse.json({ error: "calledNumber is required." }, { status: 400 });
  }

  try {
    const suite = await loadRetailRegressionSuite(calledNumber);
    return NextResponse.json(suite);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load regression suite.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

type ActionBody =
  | { action: "seed"; calledNumber?: string }
  | { action: "start_run"; calledNumber?: string; total?: number }
  | {
      action: "record_result";
      runId?: string;
      scenarioId?: string;
      grade?: RetailRegressionGrade;
      execution?: RetailRegressionExecution;
    }
  | {
      action: "finish_run";
      runId?: string;
      status?: "completed" | "cancelled" | "error";
      passed?: number;
      failed?: number;
      errored?: number;
    };

export async function POST(request: Request) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  let body: ActionBody;
  try {
    body = (await request.json()) as ActionBody;
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  try {
    if (body.action === "seed") {
      const calledNumber = String(body.calledNumber ?? "").trim();
      if (!calledNumber) {
        return NextResponse.json({ error: "calledNumber is required." }, { status: 400 });
      }
      const count = await seedRetailRegressionScenarios(calledNumber);
      return NextResponse.json({ ok: true, count });
    }

    if (body.action === "start_run") {
      const calledNumber = String(body.calledNumber ?? "").trim();
      const total = Number(body.total ?? 0);
      if (!calledNumber || !Number.isFinite(total) || total < 1) {
        return NextResponse.json(
          { error: "calledNumber and a positive total are required." },
          { status: 400 },
        );
      }
      const run = await startRetailRegressionRun({ calledNumber, total });
      return NextResponse.json(run);
    }

    if (body.action === "record_result") {
      const runId = String(body.runId ?? "").trim();
      const scenarioId = String(body.scenarioId ?? "").trim();
      if (!runId || !scenarioId || !body.grade || !body.execution) {
        return NextResponse.json(
          { error: "runId, scenarioId, grade and execution are required." },
          { status: 400 },
        );
      }
      const recurrence = await recordRetailRegressionResult({
        runId,
        scenarioId,
        grade: body.grade,
        execution: body.execution,
      });
      return NextResponse.json({ ok: true, ...recurrence });
    }

    if (body.action === "finish_run") {
      const runId = String(body.runId ?? "").trim();
      if (!runId) {
        return NextResponse.json({ error: "runId is required." }, { status: 400 });
      }
      await finishRetailRegressionRun({
        runId,
        status: body.status,
        passed: Number(body.passed ?? 0),
        failed: Number(body.failed ?? 0),
        errored: Number(body.errored ?? 0),
      });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Regression operation failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
