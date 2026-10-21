"use client";

import { useCallback } from "react";
import { Copy } from "lucide-react";

import { CaraTrainingFieldLabel } from "@/components/admin/cara-training-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { buildInstallerEmailBody } from "@/lib/transfer-capability-messages";
import type { StoreDepartmentRow } from "@/lib/retail-store-types";

type DeptRow = Pick<
  StoreDepartmentRow,
  "id" | "name" | "active" | "extension" | "direct_dial_e164"
>;

type Props = {
  storeName: string;
  installerName: string | null;
  departments: DeptRow[];
  perDepartment: Record<string, { canTransfer: boolean; target: string | null }>;
  onChange: (id: string, patch: Partial<DeptRow>) => void;
  disabled?: boolean;
};

export function DepartmentDdiTable({
  storeName,
  installerName,
  departments,
  perDepartment,
  onChange,
  disabled = false,
}: Props) {
  const activeDepartments = departments.filter((d) => d.active);

  const copyInstallerEmail = useCallback(
    (dept: DeptRow) => {
      const body = buildInstallerEmailBody({
        storeName,
        installerName,
        departments: [{ name: dept.name, extension: dept.extension }],
      });
      void navigator.clipboard.writeText(body);
    },
    [installerName, storeName],
  );

  if (activeDepartments.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        Add active departments in section 3 before mapping direct-dial numbers.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200">
      <table className="w-full min-w-[32rem] text-left text-sm">
        <thead className="bg-slate-50 text-xs font-medium text-slate-600">
          <tr>
            <th className="px-3 py-2">Department</th>
            <th className="px-3 py-2">Extension</th>
            <th className="px-3 py-2">Direct dial (E.164)</th>
            <th className="px-3 py-2">Live state</th>
            <th className="px-3 py-2" />
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {activeDepartments.map((dept) => {
            const cap = perDepartment[dept.id];
            const canTransfer = cap?.canTransfer === true;
            return (
              <tr key={dept.id}>
                <td className="px-3 py-2 font-medium text-slate-800">{dept.name}</td>
                <td className="px-3 py-2">
                  <Input
                    value={dept.extension ?? ""}
                    disabled={disabled}
                    placeholder="101"
                    className="h-8 max-w-[6rem] text-xs"
                    onChange={(e) =>
                      onChange(dept.id, {
                        extension: e.target.value || null,
                      })
                    }
                  />
                </td>
                <td className="px-3 py-2">
                  <Input
                    value={dept.direct_dial_e164 ?? ""}
                    disabled={disabled}
                    placeholder="+353..."
                    className="h-8 min-w-[10rem] text-xs"
                    onChange={(e) =>
                      onChange(dept.id, {
                        direct_dial_e164: e.target.value || null,
                      })
                    }
                  />
                </td>
                <td className="px-3 py-2">
                  <span
                    className={
                      canTransfer
                        ? "text-emerald-700 text-xs font-medium"
                        : "text-slate-600 text-xs"
                    }
                  >
                    {canTransfer ? "Can put through" : "Takes a message"}
                  </span>
                </td>
                <td className="px-3 py-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs"
                    disabled={disabled}
                    onClick={() => copyInstallerEmail(dept)}
                  >
                    <Copy className="size-3" aria-hidden />
                    Copy installer request
                  </Button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="text-muted-foreground border-t border-slate-100 px-3 py-2 text-xs">
        Extension is diagnostic only. Cara transfers only to a valid direct-dial
        number.
      </p>
    </div>
  );
}

export function DdiRangeQuestion({
  value,
  onChange,
  disabled,
}: {
  value: "yes" | "no" | "unknown" | null;
  onChange: (value: "yes" | "no" | "unknown") => void;
  disabled?: boolean;
}) {
  const options: { id: "yes" | "no" | "unknown"; label: string; hint: string }[] =
    [
      {
        id: "yes",
        label: "Yes — departments have direct-dial numbers",
        hint: "Map each department DDI below.",
      },
      {
        id: "no",
        label: "No — internal extensions only",
        hint: "Cara takes messages; email the installer about adding DDIs.",
      },
      {
        id: "unknown",
        label: "Don't know yet",
        hint: "Needs telecoms info before transfers can go live.",
      },
    ];

  return (
    <div className="space-y-2">
      <CaraTrainingFieldLabel
        label="Do departments have direct-dial numbers from outside?"
        feed="behaviour"
      />
      <div className="space-y-2">
        {options.map((opt) => (
          <label
            key={opt.id}
            className="flex cursor-pointer items-start gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2.5 has-[:checked]:border-gray-300 has-[:checked]:bg-gray-50/50"
          >
            <input
              type="radio"
              name="has-ddi-range"
              className="mt-0.5"
              checked={value === opt.id}
              disabled={disabled}
              onChange={() => onChange(opt.id)}
            />
            <span>
              <span className="block text-sm font-medium text-slate-800">
                {opt.label}
              </span>
              <span className="text-muted-foreground mt-0.5 block text-xs">
                {opt.hint}
              </span>
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}
