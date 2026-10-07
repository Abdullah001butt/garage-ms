/** Widget sizes on the 6-column dashboard grid: ⅓, ½, ⅔ and full width. */
export type WidgetSize = 2 | 3 | 4 | 6;
export type LayoutItem = { id: string; size: WidgetSize; hidden: boolean };
export type DashboardLayout = { v: 1; items: LayoutItem[] };

export type WidgetSpec = { id: string; title: string; description: string; sizes: WidgetSize[]; size: WidgetSize; hidden?: boolean };

const SIZES: WidgetSize[] = [2, 3, 4, 6];

/** Saved layout + current widget catalogue → the order, size and visibility to render. */
export function resolveLayout(specs: WidgetSpec[], saved: unknown): LayoutItem[] {
  const byId = new Map(specs.map((s) => [s.id, s]));
  const out: LayoutItem[] = [];
  const seen = new Set<string>();
  const items = (saved as DashboardLayout | null)?.items;
  if (Array.isArray(items)) {
    for (const it of items) {
      const spec = it && byId.get(it.id);
      if (!spec || seen.has(spec.id)) continue;
      const size = SIZES.includes(it.size) && spec.sizes.includes(it.size) ? it.size : spec.size;
      out.push({ id: spec.id, size, hidden: !!it.hidden });
      seen.add(spec.id);
    }
  }
  // Widgets added since the layout was saved go to the end in their default state.
  for (const spec of specs) if (!seen.has(spec.id)) out.push({ id: spec.id, size: spec.size, hidden: !!spec.hidden });
  return out;
}

export const defaultLayout = (specs: WidgetSpec[]): LayoutItem[] => specs.map((s) => ({ id: s.id, size: s.size, hidden: !!s.hidden }));
