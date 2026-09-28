"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";

import { adminPhonePoolPath } from "@/lib/admin-route-paths";

import { AdminBadge, adminTableMutedClass } from "@/components/admin/admin-badge";
import { AdminListCard } from "@/components/admin/admin-list-card";
import {
  adminClickableTableRowClass,
  adminSegmentedTabButtonClass,
  adminTextLinkClass,
} from "@/components/admin/admin-interactive";
import type { AdminDemoCallLine } from "@/lib/admin-demo-call-lines";
import { formatIrishE164Display } from "@/lib/admin-demo-call-lines";
import {
  clientProvisionSourceLabel,
  type ClientProvisionFilter,
} from "@/lib/client-provision-source";
import {
  ORGANIZATION_NICHE_ADMIN_LABELS,
  parseOrganizationNiche,
} from "@/lib/organization-niche";
import { cn } from "@/lib/utils";
import {
  adminTableBodyClass,
  adminTableClass,
  adminTableEmptyClass,
  adminTableHeadClass,
  adminTableRowClass,
  adminTableTdClass,
  adminTableThClass,
} from "@/components/admin/admin-table";

const FILTER_TABS: { value: ClientProvisionFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "managed", label: "Managed" },
  { value: "self_serve", label: "Self-serve" },
];

export function DemoCallFilterTabs({
  activeValue,
  onChange,
}: {
  activeValue: ClientProvisionFilter;
  onChange: (value: ClientProvisionFilter) => void;
}) {
  return (
    <div
      className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-0.5"
      role="tablist"
      aria-label="Store type"
    >
      {FILTER_TABS.map(({ value, label }) => {
        const active = activeValue === value;
        return (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(value)}
            className={cn(
              adminSegmentedTabButtonClass,
              active
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-600 hover:text-gray-900",
            )}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

type DemoCallLinePickerProps = {
  lines: AdminDemoCallLine[];
  selectedE164: string | null;
  onSelectedE164Change: (e164: string | null) => void;
  disabled?: boolean;
  toolbarAction?: React.ReactNode;
  compact?: boolean;
};

export function DemoCallLinePicker({
  lines,
  selectedE164,
  onSelectedE164Change,
  disabled = false,
  toolbarAction,
  compact = false,
}: DemoCallLinePickerProps) {
  const [provisionFilter, setProvisionFilter] =
    useState<ClientProvisionFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredLines = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return lines.filter((line) => {
      if (provisionFilter !== "all" && line.provisionSource !== provisionFilter) {
        return false;
      }
      if (!q) return true;
      return (
        line.orgName.toLowerCase().includes(q) ||
        line.orgSlug.toLowerCase().includes(q) ||
        line.e164.includes(q) ||
        formatIrishE164Display(line.e164).toLowerCase().includes(q) ||
        ORGANIZATION_NICHE_ADMIN_LABELS[
          parseOrganizationNiche(line.niche)
        ]
          .toLowerCase()
          .includes(q)
      );
    });
  }, [lines, provisionFilter, searchQuery]);

  const selectedLine =
    lines.find((line) => line.e164 === selectedE164) ??
    filteredLines[0] ??
    null;

  useEffect(() => {
    if (
      selectedE164 &&
      filteredLines.some((line) => line.e164 === selectedE164)
    ) {
      return;
    }
    onSelectedE164Change(filteredLines[0]?.e164 ?? null);
  }, [filteredLines, onSelectedE164Change, selectedE164]);

  const countLabel = `${filteredLines.length} line${filteredLines.length === 1 ? "" : "s"}${
    provisionFilter !== "all"
      ? ` · ${clientProvisionSourceLabel(provisionFilter)}`
      : ""
  }${searchQuery.trim() ? " · filtered" : ""}`;

  if (compact) {
    return (
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
            Testing line
          </p>
          <p className="mt-0.5 truncate text-sm font-medium text-gray-900">
            {selectedLine?.orgName ?? "No line selected"}
          </p>
        </div>

        <select
          value={selectedLine?.e164 ?? ""}
          disabled={disabled || lines.length === 0}
          onChange={(event) => onSelectedE164Change(event.target.value || null)}
          className="min-w-[16rem] flex-1 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm outline-none focus:border-gray-300 focus:ring-2 focus:ring-gray-200/80 disabled:opacity-60"
        >
          {lines.map((line) => (
            <option key={line.e164} value={line.e164}>
              {line.orgName} · {formatIrishE164Display(line.e164)}
            </option>
          ))}
        </select>

        {selectedLine ? (
          <div className="flex shrink-0 items-center gap-2 text-xs text-gray-500">
            <AdminBadge variant="plain">
              {clientProvisionSourceLabel(selectedLine.provisionSource)}
            </AdminBadge>
            <span>{selectedLine.workerPath}</span>
          </div>
        ) : null}

        {toolbarAction}
      </div>
    );
  }
  return (
    <AdminListCard
      countLabel={countLabel}
      toolbar={
        <>
          <DemoCallFilterTabs
            activeValue={provisionFilter}
            onChange={setProvisionFilter}
          />
          <div className="relative min-w-[12rem] flex-1 sm:max-w-xs">
            <Search
              className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-gray-400"
              aria-hidden
            />
            <input
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search company, slug, number…"
              disabled={disabled}
              className="w-full rounded-md border border-gray-200 bg-white py-1.5 pr-3 pl-8 text-sm text-gray-900 shadow-sm outline-none placeholder:text-gray-400 focus:border-gray-300 focus:ring-2 focus:ring-gray-200/80 disabled:opacity-60"
            />
          </div>
          {toolbarAction}
        </>
      }
    >
      <table className={adminTableClass}>
        <thead className={adminTableHeadClass}>
          <tr>
            <th className={adminTableThClass}>Company</th>
            <th className={adminTableThClass}>Type</th>
            <th className={adminTableThClass}>Niche</th>
            <th className={adminTableThClass}>Number</th>
            <th className={adminTableThClass}>Lane</th>
          </tr>
        </thead>
        <tbody className={adminTableBodyClass}>
          {filteredLines.length === 0 ? (
            <tr>
              <td colSpan={5} className={adminTableEmptyClass}>
                No assigned lines match your search. Assign a number in{" "}
                <Link href={adminPhonePoolPath()} className={adminTextLinkClass}>
                  Phone pool
                </Link>{" "}
                first.
              </td>
            </tr>
          ) : (
            filteredLines.map((line) => {
              const selected = line.e164 === selectedLine?.e164;
              return (
                <tr
                  key={line.e164}
                  className={cn(
                    adminTableRowClass,
                    selected && "bg-slate-50",
                    disabled ? "opacity-60" : adminClickableTableRowClass,
                  )}
                  onClick={() => {
                    if (!disabled) onSelectedE164Change(line.e164);
                  }}
                  aria-selected={selected}
                >
                  <td className={adminTableTdClass}>
                    <div className="flex items-start gap-2">
                      <span
                        className={cn(
                          "mt-1 inline-flex size-3.5 shrink-0 rounded-full border",
                          selected
                            ? "border-gray-900 bg-gray-900"
                            : "border-gray-300 bg-white",
                        )}
                        aria-hidden
                      />
                      <div>
                        <span className="font-medium text-gray-900">{line.orgName}</span>
                        {line.orgSlug ? (
                          <span className="mt-0.5 block font-mono text-xs text-gray-400">
                            {line.orgSlug}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </td>
                  <td className={adminTableTdClass}>
                    <AdminBadge variant="plain">
                      {clientProvisionSourceLabel(line.provisionSource)}
                    </AdminBadge>
                  </td>
                  <td className={adminTableTdClass}>
                    <span className={adminTableMutedClass}>
                      {
                        ORGANIZATION_NICHE_ADMIN_LABELS[
                          parseOrganizationNiche(line.niche)
                        ]
                      }
                    </span>
                  </td>
                  <td className={adminTableTdClass}>
                    <span className="font-mono text-xs text-gray-700">
                      {formatIrishE164Display(line.e164)}
                    </span>
                  </td>
                  <td className={adminTableTdClass}>
                    <span className={adminTableMutedClass}>{line.workerPath}</span>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </AdminListCard>
  );
}

export function resolveSelectedDemoLine(
  lines: AdminDemoCallLine[],
  selectedE164: string | null,
): AdminDemoCallLine | null {
  return lines.find((line) => line.e164 === selectedE164) ?? lines[0] ?? null;
}
