import type { ReactNode } from "react";
import { Lock, Settings2, FileText } from "lucide-react";

import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export type CaraTrainingFieldFeed = "prompt" | "internal" | "behaviour";

export function CaraTrainingFeedLegend() {
  return (
    <div className="rounded-lg border border-gray-200/80 bg-gray-50/60 px-3 py-2.5">
      <p className="text-muted-foreground text-xs leading-relaxed">
        <span className="mr-3 inline-flex items-center gap-1.5">
          <FileText className="size-3 text-gray-600" aria-hidden />
          <span className="font-medium text-gray-800">Cara reads</span>
          — information she can use in calls
        </span>
        <span className="mr-3 inline-flex items-center gap-1.5">
          <Settings2 className="size-3 text-gray-600" aria-hidden />
          <span className="font-medium text-gray-800">Behaviour</span>
          — changes how she handles calls
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Lock className="size-3 text-gray-400" aria-hidden />
          <span className="font-medium text-gray-600">Internal</span>
          — saved but not spoken
        </span>
      </p>
    </div>
  );
}

export function CaraTrainingInternalBanner({
  children,
}: {
  children?: ReactNode;
}) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-gray-200 bg-gray-50/80 px-3 py-2.5 text-xs text-gray-600">
      <Lock className="mt-0.5 size-3.5 shrink-0 text-gray-400" aria-hidden />
      <div>
        <p className="font-medium text-gray-700">Internal only</p>
        <p className="mt-0.5 leading-relaxed">
          {children ??
            "Saved for routing and administration. These fields are not spoken to callers."}
        </p>
      </div>
    </div>
  );
}

function FeedBadge({ feed }: { feed: CaraTrainingFieldFeed }) {
  if (feed === "prompt") {
    return (
      <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-700">
        <FileText className="size-2.5" aria-hidden />
        Cara reads
      </span>
    );
  }
  if (feed === "behaviour") {
    return (
      <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-700">
        <Settings2 className="size-2.5" aria-hidden />
        Behaviour
      </span>
    );
  }
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-gray-200/70 px-2 py-0.5 text-[11px] font-medium text-gray-600">
      <Lock className="size-2.5" aria-hidden />
      Internal
    </span>
  );
}

export function CaraTrainingFieldLabel({
  label,
  feed,
  htmlFor,
}: {
  label: ReactNode;
  feed: CaraTrainingFieldFeed;
  htmlFor?: string;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <Label
        htmlFor={htmlFor}
        className={cn(
          "text-xs",
          feed === "prompt" ? "font-medium text-gray-900" : "text-gray-700",
        )}
      >
        {label}
      </Label>
      <FeedBadge feed={feed} />
    </div>
  );
}

export function CaraTrainingField({
  label,
  htmlFor,
  feed = "prompt",
  hint,
  children,
  className,
}: {
  label: ReactNode;
  htmlFor?: string;
  feed?: CaraTrainingFieldFeed;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  const highlighted = feed === "prompt" || feed === "behaviour";

  return (
    <div
      className={cn(
        "space-y-2",
        highlighted &&
          feed === "prompt" &&
          "rounded-md border border-[#e0e3e6] bg-white px-3 py-2.5",
        highlighted &&
          feed === "behaviour" &&
          "rounded-md border border-[#e0e3e6] bg-white px-3 py-2.5",
        !highlighted && className,
        highlighted && className,
      )}
    >
      <CaraTrainingFieldLabel label={label} feed={feed} htmlFor={htmlFor} />
      {hint ? (
        <p className="text-muted-foreground text-[11px] leading-snug">{hint}</p>
      ) : null}
      {children}
    </div>
  );
}
