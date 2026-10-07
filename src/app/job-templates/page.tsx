import { createClient } from "@/lib/supabase/server";
import type { JobTemplate, JobTemplateItem } from "@/lib/types";
import { createJobTemplate, updateJobTemplate, deleteJobTemplate } from "@/app/job-templates/actions";
import { Card, PageHeader, EmptyState, PrimaryButton, Field, inputClass } from "@/components/ui";
import { RowMenu, RowMenuDelete, RowMenuOpenPanel, RowMenuSeparator } from "@/components/RowMenu";
import { SlideOver } from "@/components/SlideOver";
import { Icon } from "@/components/icons";
import { formatAed } from "@/lib/format";

export default async function JobTemplatesPage() {
  const supabase = await createClient();
  const [{ data: templates, error }, { data: items }] = await Promise.all([
    supabase.from("job_templates").select("*").order("created_at").returns<JobTemplate[]>(),
    supabase.from("job_template_items").select("*").order("sort_order").returns<JobTemplateItem[]>(),
  ]);

  const itemsByTemplate = new Map<string, JobTemplateItem[]>();
  for (const item of items ?? []) {
    const list = itemsByTemplate.get(item.template_id) ?? [];
    list.push(item);
    itemsByTemplate.set(item.template_id, list);
  }

  return (
    <div className="page">
      <PageHeader
        title="Quick Job Templates"
        description="One-tap common services with pre-filled description and typical pricing."
        action={
          <SlideOver title="New job template" description="A reusable job with its typical line items and prices." triggerLabel="New Template">
        <form action={createJobTemplate} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Template Name" name="name" placeholder="Oil Change" required />
            <Field label="Job Description" name="description" placeholder="Oil & filter change" required />
          </div>
    
          <div>
            <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-2">
              Typical Line Items (optional, up to 4)
            </p>
            <div className="space-y-3">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                  <input
                    type="text"
                    name={`item_description_${i}`}
                    placeholder="Description"
                    className={`${inputClass} sm:col-span-full`}
                  />
                  <select name={`item_type_${i}`} className={inputClass} defaultValue="part">
                    <option value="part">Part</option>
                    <option value="labor">Labor</option>
                    <option value="service">Service</option>
                  </select>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="number"
                      name={`item_quantity_${i}`}
                      placeholder="Qty"
                      step="0.01"
                      defaultValue={1}
                      className={inputClass}
                    />
                    <input
                      type="number"
                      name={`item_price_${i}`}
                      placeholder="Price"
                      step="0.01"
                      className={inputClass}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
    
          <PrimaryButton type="submit">Create Template</PrimaryButton>
        </form>
          </SlideOver>
        }
      />

      {error && <p className="text-red-600 text-sm mb-4">Failed to load templates: {error.message}</p>}

      {templates?.length === 0 && (
        <Card>
          <EmptyState icon="file" message="No templates yet. Create one for jobs you do often, like an oil change." />
        </Card>
      )}
      <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {templates?.map((t) => {
            const templateItems = itemsByTemplate.get(t.id) ?? [];
            const total = templateItems.reduce((s, i) => s + i.quantity * i.unit_price, 0);
            return (
              <li key={t.id} className="flex flex-col rounded-lg border border-zinc-200 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
                <div className="flex items-start justify-between gap-3 p-4 pb-3">
                  <div className="flex min-w-0 gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-zinc-200 bg-zinc-50 text-zinc-500">
                      <Icon name="wrench" className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-medium text-zinc-900">{t.name}</p>
                      <p className="line-clamp-2 text-[13px] text-zinc-500">{t.description}</p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <SlideOver id={`edit-template-${t.id}`} hideTrigger title="Edit job template" description="Change the name, description or line items." triggerLabel="Edit">
                      <form action={updateJobTemplate.bind(null, t.id)} className="space-y-4">
                        <Field label="Template Name" name="name" defaultValue={t.name} required />
                        <Field label="Job Description" name="description" defaultValue={t.description} required />
                        <div>
                          <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-2">
                            Typical Line Items (replaces existing)
                          </p>
                          <div className="space-y-2">
                            {[0, 1, 2, 3].map((i) => {
                              const existing = templateItems[i];
                              return (
                                <div key={i} className="grid grid-cols-2 gap-2">
                                  <input
                                    type="text"
                                    name={`item_description_${i}`}
                                    placeholder="Description"
                                    defaultValue={existing?.description ?? ""}
                                    className={`${inputClass} col-span-2`}
                                  />
                                  <select
                                    name={`item_type_${i}`}
                                    className={inputClass}
                                    defaultValue={existing?.item_type ?? "part"}
                                  >
                                    <option value="part">Part</option>
                                    <option value="labor">Labor</option>
                                    <option value="service">Service</option>
                                  </select>
                                  <div className="grid grid-cols-2 gap-2">
                                    <input
                                      type="number"
                                      name={`item_quantity_${i}`}
                                      placeholder="Qty"
                                      step="0.01"
                                      defaultValue={existing?.quantity ?? ""}
                                      className={inputClass}
                                    />
                                    <input
                                      type="number"
                                      name={`item_price_${i}`}
                                      placeholder="Price"
                                      step="0.01"
                                      defaultValue={existing?.unit_price ?? ""}
                                      className={inputClass}
                                    />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                        <PrimaryButton type="submit" className="w-full">Save changes</PrimaryButton>
                      </form>
                    </SlideOver>
                    <RowMenu>
                      <RowMenuOpenPanel panelId={`edit-template-${t.id}`} icon="pencil">Edit template</RowMenuOpenPanel>
                      <RowMenuSeparator />
                      <RowMenuDelete action={deleteJobTemplate.bind(null, t.id)} confirmMessage={`Delete template "${t.name}"? This cannot be undone.`} successMessage="Template deleted." label="Delete" />
                    </RowMenu>
                  </div>
                </div>
                <div className="mt-auto border-t border-zinc-100">
                  {templateItems.length === 0 ? (
                    <p className="px-4 py-3 text-xs text-zinc-400">No line items — fills the job description only.</p>
                  ) : (
                    <ul className="divide-y divide-zinc-100 text-[13px]">
                      {templateItems.map((i) => (
                        <li key={i.id} className="flex items-baseline justify-between gap-3 px-4 py-2">
                          <span className="min-w-0 truncate text-zinc-700">
                            <span className="tabular text-zinc-400">{i.quantity} ×</span> {i.description}
                          </span>
                          <span className="shrink-0 tabular text-zinc-900">{formatAed(i.quantity * i.unit_price)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="flex items-center justify-between rounded-b-lg border-t border-zinc-100 bg-zinc-50 px-4 py-2.5 text-[13px]">
                    <span className="text-zinc-500">{templateItems.length} line items</span>
                    <span className="font-semibold tabular text-zinc-900">{formatAed(total)}</span>
                  </div>
                </div>
              </li>
            );
          })}
      </ul>

    </div>
  );
}
