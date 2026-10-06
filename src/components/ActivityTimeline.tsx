import { Icon, type IconName } from "@/components/icons";
import { formatDateTime, formatRelative } from "@/lib/format";

export type ActivityEvent = {
  id: string;
  at: string;
  title: string;
  detail?: string | null;
  actor?: string | null;
  icon: IconName;
  tone?: "green" | "blue" | "amber" | "red" | "slate";
};

const TONE: Record<NonNullable<ActivityEvent["tone"]>, string> = {
  green: "bg-emerald-50 text-emerald-600 ring-emerald-200",
  blue: "bg-sky-50 text-sky-600 ring-sky-200",
  amber: "bg-amber-50 text-amber-600 ring-amber-200",
  red: "bg-red-50 text-red-600 ring-red-200",
  slate: "bg-zinc-50 text-zinc-500 ring-zinc-200",
};

/** Vertical history of what happened, newest first. */
export function ActivityTimeline({ events, emptyMessage = "No activity yet." }: { events: ActivityEvent[]; emptyMessage?: string }) {
  const sorted = [...events].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  if (sorted.length === 0) {
    return <p className="px-4 py-8 text-center text-[13px] text-zinc-400">{emptyMessage}</p>;
  }
  return (
    <ol className="relative px-4 py-4">
      {sorted.map((e, i) => (
        <li key={e.id} className="relative flex gap-3 pb-5 last:pb-0">
          {i < sorted.length - 1 && <span className="absolute left-[15px] top-8 bottom-0 w-px bg-zinc-200" aria-hidden="true" />}
          <span className={`relative z-[1] flex h-8 w-8 shrink-0 items-center justify-center rounded-full ring-1 ${TONE[e.tone ?? "slate"]}`}>
            <Icon name={e.icon} className="h-3.5 w-3.5" />
          </span>
          <div className="min-w-0 flex-1 pt-1">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3">
              <p className="text-sm text-zinc-900">
                <span className="font-medium">{e.title}</span>
                {e.actor && <span className="text-zinc-500"> · {e.actor}</span>}
              </p>
              <time dateTime={e.at} title={formatDateTime(e.at)} className="shrink-0 text-xs text-zinc-400 tabular">
                {formatRelative(e.at)}
              </time>
            </div>
            {e.detail && <p className="mt-0.5 truncate text-[13px] text-zinc-500">{e.detail}</p>}
          </div>
        </li>
      ))}
    </ol>
  );
}

/** Icon + tone for an audit_log action key like "invoice.create". */
export function auditVisual(action: string): { icon: IconName; tone: ActivityEvent["tone"] } {
  if (action.endsWith("delete")) return { icon: "trash", tone: "red" };
  if (action.startsWith("payment")) return { icon: "wallet", tone: "green" };
  if (action.startsWith("invoice") || action.startsWith("estimate")) return { icon: "receipt", tone: "blue" };
  if (action.includes("status")) return { icon: "check-circle", tone: "blue" };
  if (action.startsWith("vehicle")) return { icon: "car", tone: "slate" };
  if (action.includes("update") || action.includes("adjust")) return { icon: "pencil", tone: "amber" };
  return { icon: "info", tone: "slate" };
}
