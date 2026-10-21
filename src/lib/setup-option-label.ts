/** Database values include the older generic onsite value. Unknown is not DIY. */
export function setupOptionLabel(tier?: string | null): string {
  switch (tier) {
    case "diy": return "Self-service";
    case "remote": return "Remote setup";
    case "onsite":
    case "onsite_dublin":
    case "onsite_other": return "In-person setup";
    default: return "Not selected";
  }
}
