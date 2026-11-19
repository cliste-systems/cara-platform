/** Shared dashboard shell (nav, layout, cross-niche pages). Bump on platform UI changes. */
export const DASHBOARD_SHELL_VERSION = "1.0";

/** Cara voice agent / prompt / call behaviour. Bump when Cara capabilities change. */
export const CARA_VERSION = "1.0";

/** Niche / vertical pack experience version. Bump when pack-specific flows change. */
export type VerticalPackVersion = {
  /** Vertical picker label, e.g. "Salon & Beauty". */
  experienceLabel: string;
  packVersion: string;
};

export type DashboardVersionDisplay = {
  experienceLine: string;
  caraLine: string;
};

export function dashboardVersionDisplay(
  pack: VerticalPackVersion,
): DashboardVersionDisplay {
  return {
    experienceLine: `${pack.experienceLabel === "Something else" ? "Business" : pack.experienceLabel} v${pack.packVersion}`,
    caraLine: `Cara v${CARA_VERSION}`,
  };
}
