"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "@/components/icons";
import { buildWhatsAppLink } from "@/lib/whatsapp";
import { bulkActionClass, useBulkSelection } from "@/components/BulkSelect";

export type ReminderTarget = { id: string; name: string; phone: string | null; message: string; detail?: string };

/**
 * Browsers block opening many WhatsApp tabs at once, so selected reminders go into
 * a queue: one tap per customer, each ticked off as it is sent.
 */
export function BulkRemindButton({
  targets,
  label = "WhatsApp reminders",
  compose,
}: {
  targets: ReminderTarget[];
  label?: string;
  /** When set, the owner writes one message for everyone; {name} becomes each first name. */
  compose?: string;
}) {
  const { selected } = useBulkSelection();
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState<Set<string>>(new Set());
  const [text, setText] = useState(compose ?? "");
  const messageFor = (t: ReminderTarget) => (compose !== undefined ? text.replace(/\{name\}/g, t.name.split(" ")[0]) : t.message);
  const queue = targets.filter((t) => selected.has(t.id));
  const withPhone = queue.filter((t) => t.phone);

  return (
    <>
      <button type="button" className={bulkActionClass} onClick={() => setOpen(true)}>
        <Icon name="message" className="h-4 w-4" />
        {label}
      </button>
      {open &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center" role="dialog" aria-modal="true" aria-label="Send reminders">
            <div className="absolute inset-0 bg-zinc-950/40" onClick={() => setOpen(false)} />
            <div className="pop-in relative w-full max-w-md overflow-hidden rounded-xl bg-white shadow-2xl">
              <div className="flex items-start justify-between gap-3 border-b border-zinc-200 px-5 py-4">
                <div>
                  <h2 className="text-base font-semibold text-zinc-900">Send {withPhone.length} {compose !== undefined ? "messages" : "reminders"}</h2>
                  <p className="mt-0.5 text-[13px] text-zinc-500">
                    Tap each one to open WhatsApp with the message ready. {sent.size}/{withPhone.length} sent.
                  </p>
                </div>
                <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="-mr-1 rounded-md p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700">
                  <Icon name="x" className="h-4 w-4" />
                </button>
              </div>
              <div className="h-1 bg-zinc-100">
                <div className="h-1 bg-emerald-500 transition-all" style={{ width: `${withPhone.length ? (sent.size / withPhone.length) * 100 : 0}%` }} />
              </div>
              {compose !== undefined && (
                <div className="border-b border-zinc-200 px-5 py-3">
                  <label className="block text-xs font-medium text-zinc-600" htmlFor="bulk-message">
                    Message <span className="font-normal text-zinc-400">· {"{name}"} is replaced with each first name</span>
                  </label>
                  <textarea
                    id="bulk-message"
                    rows={3}
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    className="mt-1.5 w-full rounded-md border border-zinc-300 px-3 py-2 text-[13px] text-zinc-900 focus:border-zinc-900 focus:outline-none"
                  />
                </div>
              )}
              <ul className="max-h-[60vh] divide-y divide-zinc-100 overflow-y-auto">
                {queue.map((t) => {
                  const done = sent.has(t.id);
                  return (
                    <li key={t.id} className="flex items-center gap-3 px-5 py-3">
                      <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${done ? "bg-emerald-500 text-white" : "bg-zinc-100 text-zinc-500"}`}>
                        {done ? <Icon name="check" className="h-3.5 w-3.5" /> : <Icon name="user" className="h-3.5 w-3.5" />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-zinc-900">{t.name}</p>
                        <p className="truncate text-xs text-zinc-500">{t.detail ?? t.phone ?? "No phone number"}</p>
                      </div>
                      {t.phone ? (
                        <a
                          href={buildWhatsAppLink(t.phone, messageFor(t))}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={() => setSent((prev) => new Set(prev).add(t.id))}
                          className={`inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-[13px] font-medium ${
                            done ? "border border-zinc-200 text-zinc-500" : "bg-[#25D366] text-white hover:bg-[#1ebe5b]"
                          }`}
                        >
                          {done ? "Sent" : "Send"}
                        </a>
                      ) : (
                        <span className="text-xs text-zinc-400">No phone</span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}

/** Goes to a link with the selected ids appended (e.g. an Excel export of just those rows). */
export function BulkLinkButton({ href, param = "ids", label, icon = "download" }: { href: string; param?: string; label: string; icon?: "download" | "printer" }) {
  const { selected } = useBulkSelection();
  const url = `${href}${href.includes("?") ? "&" : "?"}${param}=${[...selected].join(",")}`;
  return (
    <a href={url} className={bulkActionClass}>
      <Icon name={icon} className="h-4 w-4" />
      {label}
    </a>
  );
}
