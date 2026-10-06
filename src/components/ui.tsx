import type { ReactNode, HTMLAttributes } from "react";
import Link from "next/link";
import { Icon, type IconName } from "@/components/icons";

// Buttons need client-side form state, so they live in a separate client module.
export { PrimaryButton, SecondaryButton } from "@/components/ui-buttons";

export function Card({ children, className = "", ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`rounded-lg border border-zinc-200 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)] ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between mb-6 print:hidden">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight text-zinc-900 sm:text-[22px]">{title}</h1>
        {description && <p className="mt-1 text-sm text-zinc-500">{description}</p>}
      </div>
      {action && <div className="flex shrink-0 flex-wrap items-center gap-2">{action}</div>}
    </div>
  );
}

export function SectionHeader({
  title,
  description,
  action,
  className = "",
}: {
  title: ReactNode;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`mb-3 flex items-end justify-between gap-3 ${className}`}>
      <div className="min-w-0">
        <h2 className="text-sm font-semibold text-zinc-900">{title}</h2>
        {description && <p className="mt-0.5 text-xs text-zinc-500">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

// A card with its own header bar (title, optional count, optional link/action).
export function Panel({
  title,
  count,
  action,
  children,
  className = "",
}: {
  title: string;
  count?: number;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card className={`overflow-hidden ${className}`}>
      <div className="flex h-11 items-center justify-between gap-3 border-b border-zinc-200 px-4">
        <div className="flex min-w-0 items-center gap-2">
          <h2 className="truncate text-sm font-semibold text-zinc-900">{title}</h2>
          {count !== undefined && count > 0 && (
            <span className="rounded-full bg-zinc-100 px-1.5 py-px text-[11px] font-medium text-zinc-600 tabular">{count}</span>
          )}
        </div>
        {action && <div className="shrink-0 text-[13px]">{action}</div>}
      </div>
      {children}
    </Card>
  );
}

// Segmented link control for filters/views (e.g. All | Pending | Completed).
export function SegmentedLinks({ items }: { items: { label: string; href: string; active: boolean }[] }) {
  return (
    <div className="inline-flex max-w-full overflow-x-auto rounded-md border border-zinc-200 bg-zinc-50 p-0.5">
      {items.map((item) => (
        <Link
          key={item.href + item.label}
          href={item.href}
          className={`whitespace-nowrap rounded px-3 py-1 text-[13px] font-medium transition-colors ${
            item.active ? "bg-white text-zinc-900 shadow-[0_1px_2px_rgba(16,24,40,0.08)]" : "text-zinc-500 hover:text-zinc-900"
          }`}
        >
          {item.label}
        </Link>
      ))}
    </div>
  );
}

const ALERT_TONES = {
  warning: { box: "border-amber-200 bg-amber-50", icon: "text-amber-600", title: "text-amber-900", body: "text-amber-800", name: "alert" },
  danger: { box: "border-red-200 bg-red-50", icon: "text-red-600", title: "text-red-900", body: "text-red-800", name: "alert" },
  success: { box: "border-emerald-200 bg-emerald-50", icon: "text-emerald-600", title: "text-emerald-900", body: "text-emerald-800", name: "check-circle" },
  info: { box: "border-zinc-200 bg-white", icon: "text-zinc-400", title: "text-zinc-900", body: "text-zinc-600", name: "info" },
} as const;

// Inline notice with an icon — replaces emoji-prefixed warning boxes.
export function Alert({
  tone = "warning",
  title,
  children,
  icon,
  className = "",
}: {
  tone?: keyof typeof ALERT_TONES;
  title?: ReactNode;
  children?: ReactNode;
  icon?: IconName;
  className?: string;
}) {
  const t = ALERT_TONES[tone];
  return (
    <div className={`flex gap-2.5 rounded-md border px-3.5 py-3 ${t.box} ${className}`}>
      <Icon name={icon ?? t.name} className={`mt-0.5 h-4 w-4 ${t.icon}`} />
      <div className="min-w-0 text-[13px]">
        {title && <p className={`font-medium ${t.title}`}>{title}</p>}
        {children && <div className={`${title ? "mt-0.5" : ""} ${t.body}`}>{children}</div>}
      </div>
    </div>
  );
}

// Compact empty state for use inside panels and tables.
export function PanelEmpty({ message }: { message: string }) {
  return <p className="px-4 py-6 text-center text-[13px] text-zinc-400">{message}</p>;
}

const BADGE_STYLES: Record<string, string> = {
  slate: "bg-zinc-100 text-zinc-700 ring-zinc-200",
  gray: "bg-zinc-50 text-zinc-500 ring-zinc-200",
  blue: "bg-sky-50 text-sky-700 ring-sky-200",
  amber: "bg-amber-50 text-amber-800 ring-amber-200",
  green: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  red: "bg-red-50 text-red-700 ring-red-200",
  indigo: "bg-zinc-900 text-white ring-zinc-900",
};

const BADGE_DOTS: Record<string, string> = {
  slate: "bg-zinc-400",
  gray: "bg-zinc-300",
  blue: "bg-sky-500",
  amber: "bg-amber-500",
  green: "bg-emerald-500",
  red: "bg-red-500",
  indigo: "bg-white",
};

// Raw database values like "in_progress" read as "In progress".
function toSentence(text: string) {
  const spaced = text.replace(/_/g, " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

export function Badge({
  children,
  color = "slate",
  className = "",
  dot = false,
}: {
  children: ReactNode;
  color?: keyof typeof BADGE_STYLES;
  className?: string;
  dot?: boolean;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-1.5 py-0.5 text-xs font-medium ring-1 ring-inset ${BADGE_STYLES[color]} ${className}`}
    >
      {dot && <span className={`h-1.5 w-1.5 rounded-full ${BADGE_DOTS[color]}`} />}
      {typeof children === "string" ? toSentence(children) : children}
    </span>
  );
}

export function EmptyState({ message, icon = "inbox" }: { message: string; icon?: IconName }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-4 py-10 text-center">
      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-zinc-100 text-zinc-400">
        <Icon name={icon} className="h-4 w-4" />
      </span>
      <p className="text-sm text-zinc-500">{message}</p>
    </div>
  );
}

export const inputClass =
  "w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-[0_1px_2px_rgba(16,24,40,0.04)] placeholder:text-zinc-400 focus:border-brand-500 focus:outline-none focus:ring-3 focus:ring-brand-500/15 disabled:bg-zinc-50 disabled:text-zinc-500";

export const labelClass = "block text-[13px] font-medium text-zinc-700 mb-1.5";

// Shared table styling so every list in the app reads the same way.
export const tableClass = "w-full text-sm";
export const theadClass = "border-b border-zinc-200 bg-zinc-50/80 text-left";
export const thClass = "px-4 py-2.5 text-xs font-medium text-zinc-500 whitespace-nowrap";
export const tdClass = "px-4 py-3 text-zinc-700";
export const trClass = "border-b border-zinc-100 last:border-0 hover:bg-zinc-50/60";

export function Field({
  label,
  name,
  type = "text",
  required = false,
  placeholder,
  step,
  defaultValue,
  className = "",
  list,
  pattern,
  title,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
  step?: string;
  defaultValue?: string | number;
  className?: string;
  list?: string;
  pattern?: string;
  title?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className={labelClass}>
        {label}
        {required && <span className="text-brand-600"> *</span>}
      </span>
      <input
        type={type}
        name={name}
        required={required}
        placeholder={placeholder}
        step={step}
        defaultValue={defaultValue}
        list={list}
        pattern={pattern}
        title={title}
        className={inputClass}
      />
    </label>
  );
}

export function StatCard({
  label,
  value,
  hint,
  accent = "slate",
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: "slate" | "green" | "red" | "amber" | "indigo";
}) {
  const accentClass: Record<string, string> = {
    slate: "text-zinc-900",
    green: "text-emerald-700",
    red: "text-red-700",
    amber: "text-amber-700",
    indigo: "text-zinc-900",
  };
  return (
    <Card className="p-4">
      <p className="text-[13px] font-medium text-zinc-500">{label}</p>
      <p className={`mt-1.5 text-2xl font-semibold tracking-tight tabular ${accentClass[accent]}`}>{value}</p>
      {hint && <p className="mt-1 text-xs text-zinc-500">{hint}</p>}
    </Card>
  );
}
