"use client";

import { ctxAttr } from "@/lib/ctx";
import Link from "next/link";
import { Fragment, useRef, useState } from "react";
import type { Part } from "@/lib/types";
import { Badge, EmptyState, Field, SecondaryButton } from "@/components/ui";
import { BarcodeScanner } from "@/components/BarcodeScanner";
import { buildWhatsAppLink } from "@/lib/whatsapp";
import { RowMenu, RowMenuButton, RowMenuDelete, RowMenuSeparator } from "@/components/RowMenu";
import { InlineEdit } from "@/components/InlineEdit";
import { updatePartInline } from "@/app/inline-actions";

export function InventoryTable({
  parts,
  adjustStock,
  createPurchaseOrder,
  updatePartSupplier,
  updatePart,
  deletePart,
}: {
  parts: Part[];
  adjustStock: (partId: string, formData: FormData) => void;
  createPurchaseOrder: (partId: string, formData: FormData) => void;
  updatePartSupplier: (partId: string, formData: FormData) => void;
  updatePart: (partId: string, formData: FormData) => void;
  deletePart: (partId: string) => Promise<void>;
}) {
  const [showScanner, setShowScanner] = useState(false);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [scanMessage, setScanMessage] = useState<string | null>(null);
  const [editingSupplierId, setEditingSupplierId] = useState<string | null>(null);
  const [editingPartId, setEditingPartId] = useState<string | null>(null);
  const rowRefs = useRef<Record<string, HTMLTableRowElement | null>>({});

  function handleScan(text: string) {
    setShowScanner(false);
    const match = parts.find((p) => p.sku && p.sku.toLowerCase() === text.trim().toLowerCase());
    if (match) {
      setHighlightId(match.id);
      setScanMessage(`Found: ${match.name}`);
      rowRefs.current[match.id]?.scrollIntoView({ behavior: "smooth", block: "center" });
      setTimeout(() => setHighlightId(null), 3000);
    } else {
      setScanMessage(`No part found with SKU "${text.trim()}"`);
    }
  }

  return (
    <>
      {showScanner && <BarcodeScanner onScan={handleScan} onClose={() => setShowScanner(false)} />}
      <div className="flex items-center gap-3 border-b border-zinc-200 p-3">
        <SecondaryButton type="button" icon="scan" onClick={() => setShowScanner(true)}>
          Scan barcode
        </SecondaryButton>
        {scanMessage && <span className="text-xs text-zinc-500">{scanMessage}</span>}
      </div>
      <div className="relative overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50/80 text-left text-xs text-zinc-500">
            <tr>
              <th className="px-4 py-2.5 font-medium">Part</th>
              <th className="px-4 py-2.5 font-medium">SKU</th>
              <th className="px-4 py-2.5 font-medium text-right">Stock</th>
              <th className="px-4 py-2.5 font-medium text-right">Cost</th>
              <th className="px-4 py-2.5 font-medium text-right">Price</th>
              <th className="px-4 py-2.5 font-medium">Supplier</th>
              <th className="px-4 py-2.5 font-medium">Set stock</th>
              <th className="px-4 py-2.5 font-medium">Reorder</th>
              <th className="px-4 py-2.5 font-medium"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 align-middle">
            {parts.map((part) => {
              const isLow = part.stock_qty <= part.reorder_threshold;
              return (
                <Fragment key={part.id}>
                <tr
                  {...ctxAttr({ t: "part", id: part.id, name: part.name, sku: part.sku })}
                  ref={(el) => {
                    rowRefs.current[part.id] = el;
                  }}
                  className={highlightId === part.id ? "bg-amber-50 transition-colors" : ""}
                >
                  <td className="min-w-40 px-4 py-2.5 font-medium text-zinc-900">
                    <Link href={`/inventory/${part.id}`} className="hover:underline" title="Stock history">
                      {part.name}
                    </Link>
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5 font-mono text-xs text-zinc-500">{part.sku ?? "—"}</td>
                  <td className="px-4 py-2.5 text-right tabular">
                    <InlineEdit
                      label="Stock"
                      kind="number"
                      align="right"
                      value={String(part.stock_qty)}
                      display={isLow ? <Badge color="red">{part.stock_qty} low</Badge> : part.stock_qty}
                      action={updatePartInline.bind(null, part.id, "stock_qty")}
                    />
                  </td>
                  <td className="px-4 py-2.5 text-right text-zinc-600 tabular">
                    <InlineEdit label="Cost" kind="number" align="right" value={part.unit_cost?.toFixed(2) ?? ""} display={part.unit_cost?.toFixed(2) ?? "—"} action={updatePartInline.bind(null, part.id, "unit_cost")} />
                  </td>
                  <td className="px-4 py-2.5 text-right text-zinc-900 tabular">
                    <InlineEdit label="Price" kind="number" align="right" value={part.unit_price?.toFixed(2) ?? ""} display={part.unit_price?.toFixed(2) ?? "—"} action={updatePartInline.bind(null, part.id, "unit_price")} />
                  </td>
                  <td className="px-4 py-2.5">
                    {editingSupplierId === part.id ? (
                      <form
                        action={(fd) => {
                          updatePartSupplier(part.id, fd);
                          setEditingSupplierId(null);
                        }}
                        className="flex flex-col gap-1"
                      >
                        <input
                          type="text"
                          name="supplier_name"
                          defaultValue={part.supplier_name ?? ""}
                          placeholder="Supplier name"
                          className="w-32 rounded-md border border-zinc-300 px-2 py-1 text-xs"
                        />
                        <input
                          type="text"
                          name="supplier_phone"
                          defaultValue={part.supplier_phone ?? ""}
                          placeholder="Phone"
                          className="w-32 rounded-md border border-zinc-300 px-2 py-1 text-xs"
                        />
                        <div className="flex gap-1">
                          <button type="submit" className="rounded-md border border-zinc-300 bg-white text-zinc-800 shadow-[0_1px_2px_rgba(16,24,40,0.05)] hover:bg-zinc-50 px-2 py-1 text-xs font-medium">
                            Save
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingSupplierId(null)}
                            className="rounded-md border border-zinc-300 px-2 py-1 text-xs hover:bg-zinc-50"
                          >
                            Cancel
                          </button>
                        </div>
                      </form>
                    ) : (
                      <div className="flex flex-col gap-1">
                        {part.supplier_name ? (
                          <>
                            <span className="text-zinc-700">{part.supplier_name}</span>
                            {part.supplier_phone && (
                              <a
                                href={buildWhatsAppLink(
                                  part.supplier_phone,
                                  `Hi ${part.supplier_name}, we'd like to restock "${part.name}"${part.sku ? ` (SKU ${part.sku})` : ""} at Al Bahir Garage. Please let us know availability and price.`
                                )}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs font-medium text-emerald-700 hover:text-emerald-900"
                              >
                                WhatsApp
                              </a>
                            )}
                          </>
                        ) : (
                          <span className="text-zinc-400">—</span>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    <form action={adjustStock.bind(null, part.id)} className="flex gap-2">
                      <input
                        type="number"
                        name="stock_qty"
                        defaultValue={part.stock_qty}
                        className="h-8 w-20 rounded-md border border-zinc-300 px-2 text-sm tabular focus:border-brand-500 focus:outline-none focus:ring-3 focus:ring-brand-500/15"
                      />
                      <button
                        type="submit"
                        className="h-8 rounded-md border border-zinc-300 bg-white px-2.5 text-xs font-medium text-zinc-800 hover:bg-zinc-50"
                      >
                        Save
                      </button>
                    </form>
                  </td>
                  <td className="px-4 py-2.5">
                    <form action={createPurchaseOrder.bind(null, part.id)} className="flex gap-2">
                      <input
                        type="number"
                        name="quantity"
                        placeholder="Qty"
                        defaultValue={isLow ? Math.max(part.reorder_threshold * 2, 10) : ""}
                        className="h-8 w-16 rounded-md border border-zinc-300 px-2 text-sm tabular focus:border-brand-500 focus:outline-none focus:ring-3 focus:ring-brand-500/15"
                      />
                      <button
                        type="submit"
                        className="rounded-md border border-zinc-300 bg-white text-zinc-800 shadow-[0_1px_2px_rgba(16,24,40,0.05)] hover:bg-zinc-50 h-8 px-2.5 text-xs font-medium"
                      >
                        Order
                      </button>
                    </form>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex justify-end">
                      <RowMenu>
                        <RowMenuButton icon="pencil" onClick={() => setEditingPartId(editingPartId === part.id ? null : part.id)}>
                          Edit part
                        </RowMenuButton>
                        <RowMenuButton icon="user" onClick={() => setEditingSupplierId(part.id)}>
                          Edit supplier
                        </RowMenuButton>
                        <RowMenuSeparator />
                        <RowMenuDelete
                          action={deletePart.bind(null, part.id)}
                          confirmMessage={`Delete part "${part.name}"?`}
                          successMessage="Part deleted."
                        />
                      </RowMenu>
                    </div>
                  </td>
                </tr>
                {editingPartId === part.id && (
                  <tr className="bg-zinc-50">
                    <td colSpan={8} className="px-4 py-3">
                      <form
                        action={(fd) => {
                          updatePart(part.id, fd);
                          setEditingPartId(null);
                        }}
                        className="grid grid-cols-1 sm:grid-cols-3 gap-3"
                      >
                        <Field label="Name" name="name" defaultValue={part.name} required />
                        <Field label="SKU" name="sku" defaultValue={part.sku ?? ""} />
                        <Field label="Reorder Threshold" name="reorder_threshold" type="number" defaultValue={part.reorder_threshold} />
                        <Field label="Unit Cost" name="unit_cost" type="number" step="0.01" defaultValue={part.unit_cost ?? ""} />
                        <Field label="Unit Price" name="unit_price" type="number" step="0.01" defaultValue={part.unit_price ?? ""} />
                        <div className="flex items-end gap-2">
                          <button type="submit" className="rounded-md border border-zinc-300 bg-white text-zinc-800 shadow-[0_1px_2px_rgba(16,24,40,0.05)] hover:bg-zinc-50 px-3 py-1.5 text-xs font-medium">
                            Save Part
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingPartId(null)}
                            className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs hover:bg-zinc-50"
                          >
                            Cancel
                          </button>
                        </div>
                      </form>
                    </td>
                  </tr>
                )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
        {parts.length === 0 && <EmptyState icon="package" title="No parts yet" message="Add the parts you keep on the shelf so invoices pick prices and stock counts itself." />}
      </div>
    </>
  );
}
