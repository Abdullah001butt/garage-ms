"use client";

import type { ReactNode, ButtonHTMLAttributes } from "react";
import { useFormStatus } from "react-dom";
import { Icon, type IconName } from "@/components/icons";

function Spinner({ className = "" }: { className?: string }) {
  return (
    <svg className={`animate-spin h-4 w-4 ${className}`} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  );
}

// A leading "+ " in a button label is rendered as a proper plus icon, so
// existing labels like "+ Add Customer" pick up the icon automatically.
function withLeadingIcon(children: ReactNode, icon?: IconName) {
  if (icon) {
    return (
      <>
        <Icon name={icon} className="h-4 w-4 -ml-0.5" />
        {children}
      </>
    );
  }
  if (typeof children === "string" && children.startsWith("+ ")) {
    return (
      <>
        <Icon name="plus" className="h-4 w-4 -ml-0.5" />
        {children.slice(2)}
      </>
    );
  }
  return children;
}

const BUTTON_BASE =
  "inline-flex h-9 items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-3.5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-60 disabled:cursor-not-allowed";

export function PrimaryButton({
  children,
  className = "",
  disabled,
  icon,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { icon?: IconName }) {
  const { pending } = useFormStatus();
  const isPending = rest.type === "submit" && pending;
  return (
    <button
      className={`${BUTTON_BASE} bg-brand-600 text-white shadow-[0_1px_2px_rgba(16,24,40,0.08)] hover:bg-brand-700 focus-visible:outline-brand-600 ${className}`}
      disabled={disabled || isPending}
      {...rest}
    >
      {isPending ? (
        <>
          <Spinner />
          {typeof children === "string" ? children.replace(/^\+ /, "") : children}
        </>
      ) : (
        withLeadingIcon(children, icon)
      )}
    </button>
  );
}

export function SecondaryButton({
  children,
  className = "",
  disabled,
  icon,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { icon?: IconName }) {
  const { pending } = useFormStatus();
  const isPending = rest.type === "submit" && pending;
  return (
    <button
      className={`${BUTTON_BASE} border border-zinc-300 bg-white text-zinc-800 shadow-[0_1px_2px_rgba(16,24,40,0.05)] hover:bg-zinc-50 focus-visible:outline-zinc-400 ${className}`}
      disabled={disabled || isPending}
      {...rest}
    >
      {isPending ? (
        <>
          <Spinner className="text-zinc-500" />
          {typeof children === "string" ? children.replace(/^\+ /, "") : children}
        </>
      ) : (
        withLeadingIcon(children, icon)
      )}
    </button>
  );
}
