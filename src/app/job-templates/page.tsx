import { createClient } from "@/lib/supabase/server";
import type { JobTemplate, JobTemplateItem } from "@/lib/types";
import { createJobTemplate, deleteJobTemplate } from "@/app/job-templates/actions";
import { Card, PageHeader, EmptyState, PrimaryButton, Field, inputClass } from "@/components/ui";

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
    <div className="mx-auto max-w-3xl p-6 md:p-8">
      <PageHeader
        title="Quick Job Templates"
        description="One-tap common services with pre-filled description and typical pricing."
      />

      {error && <p className="text-red-600 text-sm mb-4">Failed to load templates: {error.message}</p>}

      <Card className="mb-6 overflow-hidden">
        <ul className="divide-y divide-slate-100">
          {templates?.map((t) => {
            const templateItems = itemsByTemplate.get(t.id) ?? [];
            const total = templateItems.reduce((s, i) => s + i.quantity * i.unit_price, 0);
            return (
              <li key={t.id} className="px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-slate-900">{t.name}</p>
                    <p className="text-sm text-slate-500">{t.description}</p>
                    {templateItems.length > 0 && (
                      <ul className="mt-1 text-xs text-slate-400">
                        {templateItems.map((i) => (
                          <li key={i.id}>
                            {i.quantity} × {i.description} — AED {i.unit_price.toFixed(2)}
                          </li>
                        ))}
                        <li className="font-medium text-slate-500">Total: AED {total.toFixed(2)}</li>
                      </ul>
                    )}
                  </div>
                  <form action={deleteJobTemplate.bind(null, t.id)}>
                    <button className="text-xs text-red-500 hover:underline shrink-0">Remove</button>
                  </form>
                </div>
              </li>
            );
          })}
        </ul>
        {templates?.length === 0 && <EmptyState message="No templates yet." />}
      </Card>

      <Card className="p-5">
        <p className="text-sm font-semibold text-slate-700 mb-4">New Template</p>
        <form action={createJobTemplate} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Template Name" name="name" placeholder="Oil Change" required />
            <Field label="Job Description" name="description" placeholder="Oil & filter change" required />
          </div>

          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
              Typical Line Items (optional, up to 4)
            </p>
            <div className="space-y-3">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                  <input
                    type="text"
                    name={`item_description_${i}`}
                    placeholder="Description"
                    className={`${inputClass} sm:col-span-2`}
                  />
                  <select name={`item_type_${i}`} className={inputClass} defaultValue="part">
                    <option value="part">Part</option>
                    <option value="labor">Labor</option>
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
      </Card>
    </div>
  );
}
