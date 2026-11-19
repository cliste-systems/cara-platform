import {
  applyBookingFulfilmentMethod,
  type BookingFulfilmentMethod,
} from "@/app/(dashboard)/dashboard/routing/booking-fulfilment";
import {
  createRouteFromTemplate,
  ensureAccountRoutes,
  type SavedRoute,
} from "@/app/(dashboard)/dashboard/routing/route-models";
import { ROUTE_TEMPLATE_BY_ID } from "@/app/(dashboard)/dashboard/routing/route-templates";
import { isValidHttpUrl } from "@/app/(dashboard)/dashboard/routing/routing-validation";
import type { CaraCaptureField } from "@/app/(onboarding)/onboarding/knowledge/train-cara-capture-fields";
import type { CaraHandleOptionId } from "@/app/(onboarding)/onboarding/knowledge/train-cara-constants";
import { dashboardVerticalCopy } from "@/lib/dashboard-vertical-copy";

export const BOOKING_ROUTE_KEYWORDS = "book, booking, appointment, schedule";

export function ensureSalonBookingRouteInPayload(input: {
  routes: SavedRoute[];
  linkUrl?: string;
  captureFields: CaraCaptureField[];
  handleOptions: CaraHandleOptionId[];
  niche: string;
  businessType: string;
}): { routes: SavedRoute[]; handleOptions: CaraHandleOptionId[] } {
  const routes = ensureAccountRoutes(input.routes);
  const hasBooking = routes.some(
    (route) => route.templateId === "booking-inquiry" && route.active,
  );
  if (hasBooking) {
    return { routes, handleOptions: input.handleOptions };
  }

  const template = ROUTE_TEMPLATE_BY_ID.get("booking-inquiry");
  if (!template) {
    return { routes, handleOptions: input.handleOptions };
  }

  const verticalCopy = dashboardVerticalCopy(input.niche, input.businessType);
  const bookingUrl = String(input.linkUrl ?? "").trim();
  const method: BookingFulfilmentMethod =
    bookingUrl && isValidHttpUrl(bookingUrl) ? "link" : "callback";

  const bookingRoute = applyBookingFulfilmentMethod(
    {
      ...createRouteFromTemplate(template),
      active: true,
      keywords: BOOKING_ROUTE_KEYWORDS,
      name: "Book an appointment",
      description: verticalCopy.routing.starterBookDescription,
      url: method === "link" ? bookingUrl : "",
    },
    method,
    input.captureFields,
  );

  const nextRoutes = ensureAccountRoutes([
    ...routes.filter((route) => route.templateId !== "booking-inquiry"),
    bookingRoute,
  ]);

  const handleOptions = [...input.handleOptions];
  if (method === "link" && !handleOptions.includes("send_link")) {
    handleOptions.push("send_link");
  }

  return { routes: nextRoutes, handleOptions };
}
