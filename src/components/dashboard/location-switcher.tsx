"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Building2, Check, ChevronDown } from "lucide-react";

import { switchDashboardLocation } from "@/app/(dashboard)/dashboard/location-actions";
import {
  DASHBOARD_TOP_NAV_ITEM,
  DASHBOARD_TOP_NAV_PILL,
} from "@/components/dashboard/dashboard-surface";
import type { AccountLocationRow } from "@/lib/account-locations";
import { resolveOrganizationDisplayName } from "@/lib/organization-display-name";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type LocationSwitcherProps = {
  locations: AccountLocationRow[];
  activeOrganizationId: string;
  viewAllLocations: boolean;
  locationLabel: string;
  accountName: string;
};

function labelForLocation(location: AccountLocationRow, accountName: string) {
  const locationName = resolveOrganizationDisplayName(
    location.name,
    location.slug,
  );
  if (!locationName || locationName === accountName) return locationName;
  return locationName;
}

function workspaceLabel({
  locations,
  activeOrganizationId,
  viewAllLocations,
  locationLabel,
  accountName,
}: LocationSwitcherProps): string {
  if (locations.length > 1) {
    if (viewAllLocations) {
      return `All ${locationLabel.toLowerCase()}s`;
    }
    const activeLocation =
      locations.find((location) => location.id === activeOrganizationId) ??
      locations[0];
    if (activeLocation) {
      return (
        labelForLocation(activeLocation, accountName) || accountName
      );
    }
  }

  const primary =
    locations.find((location) => location.isPrimaryLocation) ?? locations[0];
  if (primary) {
    return labelForLocation(primary, accountName) || accountName;
  }
  return accountName;
}

/** Compact org switcher for the desktop top nav. */
export function TopNavLocationSwitcher(
  props: LocationSwitcherProps & { inline?: boolean },
) {
  const { inline = false, ...switcherProps } = props;
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const {
    locations,
    activeOrganizationId,
    viewAllLocations,
    locationLabel,
    accountName,
  } = switcherProps;
  const label = workspaceLabel(switcherProps);
  const canSwitch = locations.length > 1;

  function onSelect(organizationId: string) {
    startTransition(async () => {
      const result = await switchDashboardLocation(organizationId);
      if (result.ok) router.refresh();
    });
  }

  const trigger = inline ? (
    <span
      className={cn(
        DASHBOARD_TOP_NAV_ITEM,
        "max-w-[11rem] gap-1.5 text-slate-500 hover:text-slate-700",
        !canSwitch && "pointer-events-none",
      )}
    >
      <Building2 className="size-3.5 shrink-0 text-slate-500" aria-hidden />
      <span className="truncate">{label}</span>
      {canSwitch ? (
        <ChevronDown className="size-3 shrink-0 text-slate-400" aria-hidden />
      ) : null}
    </span>
  ) : (
    <span
      className={cn(
        DASHBOARD_TOP_NAV_PILL,
        "max-w-[12rem]",
        !canSwitch && "pointer-events-none",
      )}
    >
      <Building2 className="size-3.5 shrink-0 text-slate-500" aria-hidden />
      <span className="truncate">{label}</span>
      {canSwitch ? (
        <ChevronDown className="size-3.5 shrink-0 text-slate-400" aria-hidden />
      ) : null}
    </span>
  );

  if (!canSwitch) {
    return trigger;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={pending}
        className={cn(
          "shrink-0 rounded-full border-0 bg-transparent p-0 shadow-none outline-none transition-colors hover:bg-slate-50 disabled:opacity-60",
        )}
      >
        {trigger}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[232px]">
        <DropdownMenuGroup>
          <DropdownMenuLabel>{locationLabel}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="cursor-pointer"
            onSelect={() => onSelect("all")}
          >
            <span className="flex w-full items-center justify-between gap-2">
              <span>All {locationLabel.toLowerCase()}s</span>
              {viewAllLocations ? (
                <Check className="size-4 text-slate-700" aria-hidden />
              ) : null}
            </span>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {locations.map((location) => {
            const selected =
              !viewAllLocations && location.id === activeOrganizationId;
            return (
              <DropdownMenuItem
                key={location.id}
                className={cn("cursor-pointer", selected && "bg-slate-50")}
                onSelect={() => onSelect(location.id)}
              >
                <span className="flex w-full items-center justify-between gap-2">
                  <span className="truncate">
                    {labelForLocation(location, accountName)}
                  </span>
                  {selected ? (
                    <Check
                      className="size-4 shrink-0 text-slate-700"
                      aria-hidden
                    />
                  ) : null}
                </span>
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function LocationSwitcher({
  locations,
  activeOrganizationId,
  viewAllLocations,
  locationLabel,
  accountName,
}: LocationSwitcherProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  if (!locations || locations.length <= 1) return null;

  const triggerLabel = workspaceLabel({
    locations,
    activeOrganizationId,
    viewAllLocations,
    locationLabel,
    accountName,
  });

  function onSelect(organizationId: string) {
    startTransition(async () => {
      const result = await switchDashboardLocation(organizationId);
      if (result.ok) router.refresh();
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={pending}
        className="flex h-auto w-full items-center justify-between rounded-[18px] border border-slate-200/80 bg-white px-3 py-2.5 text-left shadow-[0_10px_28px_rgba(15,23,42,0.04)] hover:bg-[#fcfcfd] disabled:opacity-60"
      >
        <span className="flex min-w-0 items-center gap-2">
          <Building2 className="size-4 shrink-0 text-[#64748b]" aria-hidden />
          <span className="min-w-0">
            <span className="block truncate text-[12px] font-semibold text-[#0f172a]">
              {triggerLabel}
            </span>
            <span className="mt-0.5 block truncate text-[11px] text-[#64748b]">
              {accountName}
            </span>
          </span>
        </span>
        <ChevronDown className="size-4 shrink-0 text-[#cbd5e1]" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[232px]">
        <DropdownMenuGroup>
          <DropdownMenuLabel>{locationLabel}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="cursor-pointer"
            onSelect={() => onSelect("all")}
          >
            <span className="flex w-full items-center justify-between gap-2">
              <span>All {locationLabel.toLowerCase()}s</span>
              {viewAllLocations ? (
                <Check className="size-4 text-emerald-600" aria-hidden />
              ) : null}
            </span>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {locations.map((location) => {
            const selected =
              !viewAllLocations && location.id === activeOrganizationId;
            return (
              <DropdownMenuItem
                key={location.id}
                className={cn("cursor-pointer", selected && "bg-slate-50")}
                onSelect={() => onSelect(location.id)}
              >
                <span className="flex w-full items-center justify-between gap-2">
                  <span className="truncate">
                    {labelForLocation(location, accountName)}
                  </span>
                  {selected ? (
                    <Check
                      className="size-4 shrink-0 text-emerald-600"
                      aria-hidden
                    />
                  ) : null}
                </span>
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
