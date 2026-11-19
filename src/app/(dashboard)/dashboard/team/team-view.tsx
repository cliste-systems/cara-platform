"use client";
import { FormFeedback } from "@/components/ui/form-feedback";
import { DashboardSelect } from "@/components/dashboard/dashboard-select";
import {WorkspaceSectionNav} from "@/components/dashboard/workspace-section-nav";

import { useActionState, useMemo, useState } from "react";
import { Loader2, UserPlus, Users } from "lucide-react";

import { DashboardAnimatedPageSections } from "@/components/dashboard/dashboard-animated-group";
import { DashboardPageScrollBody } from "@/components/dashboard/dashboard-form-scroll-region";
import { DashboardPageHeader } from "@/components/dashboard/dashboard-page-header";
import { Field } from "@/components/dashboard/field";
import { SectionCard } from "@/components/dashboard/section-card";
import {
  DASHBOARD_HOME_CARD,
  DASHBOARD_HOME_CONTENT_COLUMN,
  DASHBOARD_INPUT_CLASS,
  DASHBOARD_PAGE_SHELL_FILL_WHITE,
  DASHBOARD_PRIMARY_BUTTON_CLASS,
} from "@/components/dashboard/dashboard-surface";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { dashboardRoleLabel } from "@/lib/team-roles";
import { cn } from "@/lib/utils";

import {
  inviteTeamMember,
  removeTeamMemberAction,
  type TeamActionResult,
} from "./actions";
import { useDashboardVertical } from "../dashboard-vertical-context";

type TeamMember = {
  id: string;
  name: string | null;
  role: string | null;
  email: string | null;
};

const INITIAL: TeamActionResult = { ok: false, message: "" };

export function TeamView({
  members,
  currentUserId,
  canManage,
}: {
  members: TeamMember[];
  currentUserId: string;
  canManage: boolean;
}) {
  const { copy, vertical } = useDashboardVertical();
  const isRetail = vertical.id === "retail";
  const canInvite = canManage && !isRetail;
  const [state, formAction, pending] = useActionState(inviteTeamMember, INITIAL);

  const ownerCount = useMemo(
    () => members.filter((member) => dashboardRoleLabel(member.role) === "Owner").length,
    [members],
  );

  const [inviteRole, setInviteRole] = useState("member");
  const fieldClass = cn(DASHBOARD_INPUT_CLASS, "text-[13px] text-[#0b1220]");

  return (
    <div
      className={cn(DASHBOARD_PAGE_SHELL_FILL_WHITE, "overflow-hidden")}
      data-dashboard-fill
    >
      <div className={DASHBOARD_HOME_CONTENT_COLUMN}>
      <DashboardAnimatedPageSections className="min-h-0 flex-1 overflow-hidden">
        <div className="shrink-0">
        <DashboardPageHeader
          eyebrow="Team"
          title="Team"
          icon={Users}
          description={isRetail ? copy.team.accessDescription : "Manage who can view calls and follow-ups, and update your business."}
          descriptionLine2="Owners can configure Cara; view-only members can monitor activity."
          summary={[
            { value: String(members.length), label: members.length === 1 ? "member" : "members" },
            { value: String(ownerCount), label: ownerCount === 1 ? "owner" : "owners" },
          ]}
        />
        <div className="mt-3"><WorkspaceSectionNav group="account"/></div>
        </div>

        <DashboardPageScrollBody scrollClassName="flex flex-col gap-4 pt-4">
        <section className={cn(DASHBOARD_HOME_CARD, "shrink-0")}>
          <h2 className="text-[15px] font-semibold tracking-tight text-[#0b1220]">
            Team members
          </h2>
          <ul className="mt-3 max-h-[360px] overflow-y-auto divide-y divide-slate-100 rounded-xl border border-slate-200/90">
            {members.map((member) => (
              <li
                key={member.id}
                className="flex items-center justify-between gap-3 px-4 py-3 first:rounded-t-xl last:rounded-b-xl"
              >
                <div className="min-w-0">
                  <p className="truncate text-[14px] font-medium text-[#0b1220]">
                    {member.name?.trim() || member.email || "Team member"}
                    {member.id === currentUserId ? (
                      <span className="ml-1.5 text-[12px] font-normal text-slate-500">
                        (you)
                      </span>
                    ) : null}
                  </p>
                  {member.email ? (
                    <p className="truncate text-[12px] text-slate-500">
                      {member.email}
                    </p>
                  ) : null}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-600">
                    {dashboardRoleLabel(member.role)}
                  </span>
                  {canInvite && member.id !== currentUserId ? (
                    <form action={removeTeamMemberAction}>
                      <input type="hidden" name="userId" value={member.id} />
                      <Button type="submit" variant="ghost" size="sm">
                        Remove
                      </Button>
                    </form>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </section>

        {canInvite ? (
          <SectionCard
            icon={UserPlus}
            title="Invite team member"
            description="They'll get an email to join your workspace."
            className="shrink-0"
          >
            <form noValidate action={formAction} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Name" htmlFor="team-invite-name">
                  <Input
                    id="team-invite-name"
                    name="name"
                    type="text"
                    placeholder="Optional"
                    className={fieldClass}
                  />
                </Field>
                <Field label="Email" htmlFor="team-invite-email">
                  <Input
                    id="team-invite-email"
                    name="email"
                    type="email"
                    required
                    placeholder="colleague@example.com"
                    className={fieldClass}
                  />
                </Field>
              </div>
              <Field
                label="Role"
                htmlFor="team-invite-role"
                hint="Owners can change Cara Setup and settings. View-only members can monitor calls and inbox activity."
              >
                <input type="hidden" name="role" value={inviteRole}/>
                <DashboardSelect id="team-invite-role" value={inviteRole} onValueChange={setInviteRole} options={[{value:"member",label:"View only"},{value:"admin",label:"Full access"}]}/>

              </Field>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                <Button
                  type="submit"
                  disabled={pending}
                  className={DASHBOARD_PRIMARY_BUTTON_CLASS}
                >
                  {pending ? (
                    <>
                      <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
                      Sending invite…
                    </>
                  ) : (
                    "Send invite"
                  )}
                </Button>
                {!state.ok && state.message ? (
                  <FormFeedback message={state.message} focusOnError />
                ) : null}
                {state.ok ? (
                  <p className="text-[13px] text-emerald-700">Invite sent.</p>
                ) : null}
              </div>
            </form>
          </SectionCard>
        ) : (
          <p className="shrink-0 text-[13px] text-slate-500">
            {isRetail
              ? "Team members are invited by Cliste during store setup."
              : "Only owners can invite or remove team members."}
          </p>
        )}
        </DashboardPageScrollBody>
      </DashboardAnimatedPageSections>
      </div>
    </div>
  );
}
