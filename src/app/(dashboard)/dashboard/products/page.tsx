import { CheckCircle2, CircleHelp, PackageSearch, XCircle } from "lucide-react";

import { DashboardAnimatedPageSections } from "@/components/dashboard/dashboard-animated-group";
import {
  DASHBOARD_CARD_SURFACE,
  DASHBOARD_HINT_CLASS,
  DASHBOARD_HOME_CONTENT_COLUMN,
  DASHBOARD_ICON_CHIP_MD,
  DASHBOARD_ICON_GLYPH_MD,
  DASHBOARD_INPUT_CLASS,
  DASHBOARD_PAGE_SHELL_FILL_WHITE,
  DASHBOARD_PRIMARY_BUTTON_CLASS,
  DASHBOARD_SELECT_CLASS,
} from "@/components/dashboard/dashboard-surface";
import { requireDashboardSession } from "@/lib/dashboard-session";
import type { RetailStoreAssortmentStatus } from "@/lib/retail-store-assortment";
import {
  resolveNationalRetailPrice,
  resolveStoredRetailPrice,
  type RetailPricePresentation,
  type RetailPromotionRow,
  type RetailStorePriceListing,
} from "@/lib/retail-price-presentation";
import { isRetailOfferPriceSemanticallyValid } from "@/lib/retail-weekly-offers-search";
import {
  retailSearchCandidateTerms,
  retailSearchTextScore,
} from "@/lib/retail-search-fuzzy";
import { createAdminClient } from "@/utils/supabase/admin";

import { ProductListRow } from "./product-list-row";

type ProductArea =
  | "all"
  | "grocery"
  | "butcher"
  | "deli"
  | "fish"
  | "bakery"
  | "produce"
  | "dairy"
  | "off_licence"
  | "cheese_counter";

type ProductFulfilment = "all" | "counter" | "prepack";

type WeeklyOfferRow = {
  sku: string | null;
  current_price_eur: number;
  was_price_eur: number | null;
  discount_label: string | null;
  price_per_unit: string | null;
  synced_at: string | null;
};

type StoreListingRow = RetailStorePriceListing & {
  product_id: string;
  synced_at: string | null;
};

type ProductPriceMeta = {
  price: RetailPricePresentation;
  sourceLabel: string;
  syncedAt: string | null;
};


type ProductsPageProps = {
  searchParams: Promise<{
    q?: string;
    filter?: string;
    area?: string;
    type?: string;
  }>;
};

type ProductRow = {
  id: string;
  product_name: string;
  brand: string | null;
  department: string | null;
  sku: string | null;
  service_area: string | null;
  fulfilment: string | null;
  category_breadcrumb: string | null;
  national_regular_price_eur: number | null;
  national_regular_price_store_count: number | null;
  search_text: string;
};

const PRODUCT_AREAS: Array<{ value: ProductArea; label: string }> = [
  { value: "all", label: "All areas" },
  { value: "grocery", label: "Grocery" },
  { value: "butcher", label: "Butcher" },
  { value: "deli", label: "Deli" },
  { value: "fish", label: "Fish" },
  { value: "bakery", label: "Bakery" },
  { value: "produce", label: "Produce" },
  { value: "dairy", label: "Dairy" },
  { value: "off_licence", label: "Off-licence" },
  { value: "cheese_counter", label: "Cheese counter" },
];

const PRODUCT_AREA_LABELS = Object.fromEntries(
  PRODUCT_AREAS.map(({ value, label }) => [value, label]),
) as Record<ProductArea, string>;

function parseProductArea(value: string | undefined): ProductArea {
  return PRODUCT_AREAS.some((area) => area.value === value)
    ? (value as ProductArea)
    : "all";
}

function parseProductFulfilment(value: string | undefined): ProductFulfilment {
  return value === "counter" || value === "prepack" ? value : "all";
}

function productAreaLabel(product: ProductRow): string | null {
  if (product.category_breadcrumb?.includes("/counter-cheese/")) {
    return "Cheese counter";
  }
  const value = product.service_area;
  if (!value) return null;
  return PRODUCT_AREA_LABELS[value as ProductArea] ?? null;
}

function hasMixedCounterAndPrepack(area: ProductArea): boolean {
  return area === "butcher" || area === "fish";
}

function productFulfilmentLabel(product: ProductRow): string | null {
  if (product.category_breadcrumb?.includes("/counter-cheese/")) {
    return "Counter";
  }
  if (product.service_area === "deli") {
    return "Counter";
  }
  if (product.service_area === "butcher" || product.service_area === "fish") {
    if (product.fulfilment === "counter") return "Counter";
    if (product.fulfilment === "prepack") return "Prepacked";
  }
  return null;
}

const ASSORTMENT_BADGE_LABEL: Record<RetailStoreAssortmentStatus, string> = {
  stocked: "Stocked",
  not_stocked: "No stock",
  not_confirmed: "Unconfirmed",
};

const STATUS_COPY: Record<
  RetailStoreAssortmentStatus,
  { label: string; description: string; className: string }
> = {
  stocked: {
    label: "Normally stocked",
    description: "Cara can say this store normally carries it, but not promise live shelf stock.",
    className: "border-emerald-200 bg-emerald-50 text-emerald-800",
  },
  not_stocked: {
    label: "Not stocked",
    description: "Cara will say it is in the wider range but this store does not normally stock it.",
    className: "border-rose-200 bg-rose-50 text-rose-800",
  },
  not_confirmed: {
    label: "Not confirmed",
    description: "Safe default. Cara will not claim this store carries it.",
    className: "border-slate-200 bg-slate-50 text-slate-700",
  },
};

function statusIcon(status: RetailStoreAssortmentStatus) {
  if (status === "stocked") return CheckCircle2;
  if (status === "not_stocked") return XCircle;
  return CircleHelp;
}

export default async function ProductsPage({ searchParams }: ProductsPageProps) {
  const { organizationId } = await requireDashboardSession();
  const params = await searchParams;
  const query = String(params.q ?? "").trim().slice(0, 100);
  const filter =
    params.filter === "stocked" ||
    params.filter === "not_stocked" ||
    params.filter === "not_confirmed"
      ? params.filter
      : "all";
  const area = parseProductArea(params.area);
  const requestedProductType = parseProductFulfilment(params.type);
  const productType = hasMixedCounterAndPrepack(area)
    ? requestedProductType
    : "all";

  const admin = createAdminClient();
  const { data: org } = await admin
    .from("organizations")
    .select("niche, retail_banner, retail_source_store_id, catalog_synced_at, offers_synced_at")
    .eq("id", organizationId)
    .maybeSingle();

  const isRetail = String(org?.niche ?? "") === "retail";
  const retailBanner = String(org?.retail_banner ?? "").trim();
  const sourceStoreId = String(org?.retail_source_store_id ?? "").trim() || null;

  let products: ProductRow[] = [];
  let loadError: string | null = null;

  if (isRetail && retailBanner && query.length >= 2) {
    const candidateTerms = retailSearchCandidateTerms(query);

    if (candidateTerms.length > 0) {
      let productQuery = admin
        .from("retail_catalog_products")
        .select("id, product_name, brand, department, sku, service_area, fulfilment, category_breadcrumb, national_regular_price_eur, national_regular_price_store_count, search_text")
        .eq("retail_banner", retailBanner)
        .or(
          candidateTerms
            .map((term) => `search_text.ilike.%${term}%`)
            .join(","),
        )
        .order("product_name", { ascending: true })
        .limit(400);

      if (retailBanner === "supervalu") {
        productQuery = productQuery.eq("is_national", true);
      }
      if (area === "cheese_counter") {
        productQuery = productQuery.ilike(
          "category_breadcrumb",
          "%/counter-cheese/%",
        );
      } else if (area === "grocery") {
        // The raw catalogue also tags counter-cheese (and a few noisy rows)
        // as grocery. In store language, Grocery means ordinary shelf stock.
        productQuery = productQuery
          .eq("service_area", "grocery")
          .eq("fulfilment", "prepack")
          .not("category_breadcrumb", "ilike", "%/counter-cheese/%");
      } else if (area !== "all") {
        productQuery = productQuery.eq("service_area", area);
      }
      if (productType !== "all") {
        productQuery = productQuery.eq("fulfilment", productType);
      }

      const { data, error } = await productQuery;
      if (error) {
        loadError = error.message;
      } else {
        products = ((data ?? []) as ProductRow[])
          .map((product) => ({
            product,
            score: retailSearchTextScore(product.search_text, query),
          }))
          .filter((entry) => entry.score > 0)
          .sort(
            (a, b) =>
              b.score - a.score ||
              a.product.product_name.localeCompare(b.product.product_name),
          )
          .slice(0, 50)
          .map((entry) => entry.product);
      }
    }
  }

  const productIds = products.map((product) => product.id);
  const overrides = new Map<string, RetailStoreAssortmentStatus>();

  if (productIds.length > 0) {
    const { data, error } = await admin
      .from("retail_store_product_assortment")
      .select("product_id, status")
      .eq("organization_id", organizationId)
      .in("product_id", productIds);

    if (error) {
      loadError = loadError ?? error.message;
    } else {
      for (const row of data ?? []) {
        if (row.status === "stocked" || row.status === "not_stocked") {
          overrides.set(row.product_id as string, row.status);
        }
      }
    }
  }

  const pricingByProductId = new Map<string, ProductPriceMeta>();

  if (productIds.length > 0) {
    const skus = products
      .map((product) => String(product.sku ?? "").trim())
      .filter(Boolean);
    const today = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Dublin",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());

    const weeklyOfferBySku = new Map<string, WeeklyOfferRow>();
    if (skus.length > 0) {
      const { data, error } = await admin
        .from("retail_weekly_offers")
        .select(
          "sku, current_price_eur, was_price_eur, discount_label, price_per_unit, synced_at",
        )
        .eq("retail_banner", retailBanner)
        .eq("is_national", true)
        .in("sku", skus)
        .lte("offer_week_start", today)
        .gte("offer_week_end", today)
        .order("synced_at", { ascending: false });

      if (error) {
        loadError = loadError ?? error.message;
      } else {
        for (const row of (data ?? []) as WeeklyOfferRow[]) {
          const sku = String(row.sku ?? "").trim();
          if (!sku || weeklyOfferBySku.has(sku)) continue;
          if (!isRetailOfferPriceSemanticallyValid(row)) continue;
          weeklyOfferBySku.set(sku, row);
        }
      }
    }

    const storeListingByProductId = new Map<string, StoreListingRow>();
    if (sourceStoreId) {
      const { data, error } = await admin
        .from("retail_store_products")
        .select(
          "product_id, regular_price_eur, display_price_eur, price_per_unit, source_price_label, synced_at, retail_promotions(promotion_type, loyalty_required, loyalty_program, offer_price_eur, regular_price_eur, label, valid_from, valid_to, synced_at)",
        )
        .eq("source_store_id", sourceStoreId)
        .eq("is_listed", true)
        .in("product_id", productIds);

      if (error) {
        loadError = loadError ?? error.message;
      } else {
        for (const raw of data ?? []) {
          const row = raw as unknown as StoreListingRow;
          storeListingByProductId.set(String(row.product_id), {
            ...row,
            retail_promotions: (row.retail_promotions ?? []) as RetailPromotionRow[],
          });
        }
      }
    }

    for (const product of products) {
      const storeListing = storeListingByProductId.get(product.id);
      if (storeListing) {
        pricingByProductId.set(product.id, {
          price: resolveStoredRetailPrice(storeListing),
          sourceLabel: "This store catalogue",
          syncedAt:
            storeListing.synced_at ??
            (typeof org?.catalog_synced_at === "string"
              ? org.catalog_synced_at
              : null),
        });
        continue;
      }

      const sku = String(product.sku ?? "").trim();
      const weeklyOffer = sku ? weeklyOfferBySku.get(sku) ?? null : null;
      pricingByProductId.set(product.id, {
        price: resolveNationalRetailPrice({
          regularPriceEur: product.national_regular_price_eur,
          weeklyOffer,
        }),
        sourceLabel: weeklyOffer
          ? "National SuperValu price / current offer"
          : "National SuperValu price",
        syncedAt:
          weeklyOffer?.synced_at ??
          (typeof org?.offers_synced_at === "string"
            ? org.offers_synced_at
            : typeof org?.catalog_synced_at === "string"
              ? org.catalog_synced_at
              : null),
      });
    }
  }

  const visibleProducts = products.filter((product) => {
    const status = overrides.get(product.id) ?? "not_confirmed";
    return filter === "all" || status === filter;
  });

  return (
    <div className={DASHBOARD_PAGE_SHELL_FILL_WHITE} data-dashboard-fill>
      <div className={DASHBOARD_HOME_CONTENT_COLUMN}>
        <DashboardAnimatedPageSections className="min-h-0 flex-1 overflow-hidden">
          <div className="flex shrink-0 items-center gap-3 px-1">
            <span className={DASHBOARD_ICON_CHIP_MD}>
              <PackageSearch className={DASHBOARD_ICON_GLYPH_MD} aria-hidden />
            </span>
            <div className="min-w-0">
              <h1 className="text-[22px] font-semibold leading-tight tracking-tight text-[#11181d]">
                Products
              </h1>
              <p className={`${DASHBOARD_HINT_CLASS} mt-0.5`}>
                Search the catalogue, check live pricing and offers, and tell Cara what this store normally carries.
              </p>
            </div>
          </div>

          {!isRetail || !retailBanner ? (
            <div className={`${DASHBOARD_CARD_SURFACE} p-5`}>
              <p className="text-sm font-medium text-slate-900">
                Product assortment is not configured for this store.
              </p>
            </div>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden">
              <form
                method="get"
                className="shrink-0 rounded-lg border border-[#dfe7e2] bg-white px-3 py-2.5 sm:px-4"
              >
                <div
                  className={
                    hasMixedCounterAndPrepack(area)
                      ? "grid gap-2 lg:grid-cols-[minmax(16rem,1fr)_11rem_11rem_11rem_auto] lg:items-end"
                      : "grid gap-2 lg:grid-cols-[minmax(16rem,1fr)_11rem_11rem_auto] lg:items-end"
                  }
                >
                  <label className="block min-w-0">
                    <span className="mb-1 block text-[10.5px] font-semibold uppercase tracking-[0.12em] text-[#6b7c75]">
                      Search {retailBanner === "supervalu" ? "SuperValu" : "retailer"}
                    </span>
                    <input
                      name="q"
                      defaultValue={query}
                      placeholder="Product, brand or SKU"
                      className={`h-10 w-full rounded-lg border px-3 text-[13px] text-[#11181d] outline-none ${DASHBOARD_INPUT_CLASS}`}
                    />
                  </label>

                  <label className="block min-w-0">
                    <span className="mb-1 block text-[10.5px] font-semibold uppercase tracking-[0.12em] text-[#6b7c75]">
                      Store area
                    </span>
                    <select
                      name="area"
                      defaultValue={area}
                      className={DASHBOARD_SELECT_CLASS}
                    >
                      {PRODUCT_AREAS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  {hasMixedCounterAndPrepack(area) ? (
                    <label className="block min-w-0">
                      <span className="mb-1 block text-[10.5px] font-semibold uppercase tracking-[0.12em] text-[#6b7c75]">
                        Product type
                      </span>
                      <select
                        name="type"
                        defaultValue={productType}
                        className={DASHBOARD_SELECT_CLASS}
                      >
                        <option value="all">All products</option>
                        <option value="counter">Counter only</option>
                        <option value="prepack">Prepacked only</option>
                      </select>
                    </label>
                  ) : null}

                  <label className="block min-w-0">
                    <span className="mb-1 block text-[10.5px] font-semibold uppercase tracking-[0.12em] text-[#6b7c75]">
                      Store status
                    </span>
                    <select
                      name="filter"
                      defaultValue={filter}
                      className={DASHBOARD_SELECT_CLASS}
                    >
                      <option value="all">All statuses</option>
                      <option value="stocked">Normally stocked</option>
                      <option value="not_stocked">Not stocked</option>
                      <option value="not_confirmed">Not confirmed</option>
                    </select>
                  </label>

                  <button
                    type="submit"
                    className={`${DASHBOARD_PRIMARY_BUTTON_CLASS} w-full px-5 lg:w-auto`}
                  >
                    Search
                  </button>
                </div>

                <p className="mt-2 text-[10.5px] leading-4 text-[#87958f]">
                  Name, brand, category or SKU. Unconfirmed products are never
                  presented as normally stocked.
                </p>
              </form>

              <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain pr-1 [scrollbar-gutter:stable]">
                {loadError ? (
                  <p className="text-sm text-red-700">Could not load products: {loadError}</p>
                ) : query.length < 2 ? (
                  <div className={`${DASHBOARD_CARD_SURFACE} p-6 text-center`}>
                    <PackageSearch className="mx-auto h-6 w-6 text-slate-400" />
                    <p className="mt-2 text-sm font-medium text-slate-800">
                      Search for a product to set this store&apos;s assortment.
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      No one has to review thousands of products up front.
                    </p>
                  </div>
                ) : visibleProducts.length === 0 ? (
                  <div className={`${DASHBOARD_CARD_SURFACE} p-6 text-center text-sm text-slate-600`}>
                    No matching products for this search and filter.
                  </div>
                ) : (
                  <div className="rounded-lg border border-[#dfe7e2] bg-white">
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[920px]">
                        <caption className="border-b border-[#e8efeb] px-4 py-2 text-left text-[11px] font-medium text-[#87958f]">
                          {visibleProducts.length === 1
                            ? "1 matching product"
                            : `${visibleProducts.length} matching products`}
                          {products.length >= 50 ? " · refine your search for more" : ""}
                        </caption>
                        <colgroup>
                          <col />
                          <col className="w-[11rem]" />
                          <col className="w-[22rem]" />
                        </colgroup>
                        <thead>
                          <tr className="border-b border-[#e8efeb] bg-[#fafbfa] text-left text-[10px] font-semibold uppercase tracking-[0.1em] text-[#87958f]">
                            <th className="px-4 py-2.5 font-semibold">Product</th>
                            <th className="px-4 py-2.5 font-semibold">Price</th>
                            <th className="px-4 py-2.5 font-semibold">Store status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {visibleProducts.map((product) => {
                            const status = overrides.get(product.id) ?? "not_confirmed";
                            const copy = STATUS_COPY[status];
                            const StatusIcon = statusIcon(status);
                            const areaLabel = productAreaLabel(product);
                            const fulfilmentLabel = productFulfilmentLabel(product);
                            const pricing = pricingByProductId.get(product.id);
                            const metaLine = [
                              product.brand,
                              product.department,
                              product.sku ? `SKU ${product.sku}` : null,
                            ]
                              .filter(Boolean)
                              .join(" · ");

                            return (
                              <ProductListRow
                                key={product.id}
                                productId={product.id}
                                productName={product.product_name}
                                metaLine={metaLine}
                                status={status}
                                statusLabel={ASSORTMENT_BADGE_LABEL[status]}
                                statusClassName={copy.className}
                                StatusIcon={StatusIcon}
                                areaLabel={areaLabel}
                                fulfilmentLabel={fulfilmentLabel}
                                fulfilment={product.fulfilment}
                                pricing={
                                  pricing
                                    ? {
                                        price: pricing.price,
                                        sourceLabel: pricing.sourceLabel,
                                        syncedAt: pricing.syncedAt,
                                      }
                                    : null
                                }
                              />
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </DashboardAnimatedPageSections>
      </div>
    </div>
  );
}
