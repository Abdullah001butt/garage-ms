import Link from "next/link";
import { thClass } from "@/components/ui";

/** Clickable column header that sorts via the URL (?sort=field&dir=asc|desc). */
export function SortHeader({
  label,
  field,
  sort,
  dir,
  href,
  align = "left",
  className = "",
  defaultDir = "desc",
}: {
  label: string;
  field: string;
  sort?: string;
  dir?: string;
  /** Builds the link for a given sort; keep other filters in it. */
  href: (sort: string, dir: "asc" | "desc") => string;
  align?: "left" | "right";
  className?: string;
  defaultDir?: "asc" | "desc";
}) {
  const active = sort === field;
  const nextDir: "asc" | "desc" = active ? (dir === "asc" ? "desc" : "asc") : defaultDir;
  return (
    <th className={`${thClass} ${align === "right" ? "text-right" : ""} ${className}`} aria-sort={active ? (dir === "asc" ? "ascending" : "descending") : undefined}>
      <Link
        href={href(field, nextDir)}
        scroll={false}
        className={`group inline-flex items-center gap-1 ${align === "right" ? "flex-row-reverse" : ""} ${active ? "text-zinc-900" : "hover:text-zinc-900"}`}
      >
        {label}
        <svg viewBox="0 0 12 12" className={`h-3 w-3 ${active ? "text-zinc-900" : "text-zinc-300 group-hover:text-zinc-500"}`} aria-hidden="true">
          <path d="M6 2.5 8.5 5h-5z" fill="currentColor" opacity={!active || dir === "asc" ? 1 : 0.25} />
          <path d="M6 9.5 3.5 7h5z" fill="currentColor" opacity={!active || dir === "desc" ? 1 : 0.25} />
        </svg>
      </Link>
    </th>
  );
}

/** Sorts rows by a key with direction; strings compare case-insensitively. */
export function sortRows<T>(rows: T[], get: (row: T) => string | number | null | undefined, dir: string | undefined) {
  const mul = dir === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const x = get(a);
    const y = get(b);
    if (x == null && y == null) return 0;
    if (x == null) return 1;
    if (y == null) return -1;
    if (typeof x === "number" && typeof y === "number") return (x - y) * mul;
    return String(x).localeCompare(String(y), undefined, { sensitivity: "base", numeric: true }) * mul;
  });
}
