"use client";

import { Icon } from "@/components/icons";
import { useState } from "react";
import { Field, labelClass, inputClass } from "@/components/ui";
import { EMIRATES } from "@/lib/plate";
import type { Customer, CustomerType } from "@/lib/types";

export function CustomerFields({
  customer,
  lockType = false,
  companies,
  defaultCompanyId,
  showCompanyPays = false,
}: {
  customer?: Customer;
  lockType?: boolean;
  /** Companies this person can be linked to as an employee. Omit to keep the current link unchanged. */
  companies?: { id: string; name: string }[];
  defaultCompanyId?: string;
  /** New-customer flow: ask whether the company pays for this person's car. */
  showCompanyPays?: boolean;
}) {
  const [type, setType] = useState<CustomerType>(customer?.customer_type ?? "individual");
  const [companyId, setCompanyId] = useState(customer?.parent_customer_id ?? defaultCompanyId ?? "");

  return (
    <>
      {!lockType && (
        <div className="col-span-2 mb-2 flex gap-2">
          <button
            type="button"
            onClick={() => setType("individual")}
            className={`flex flex-1 items-center justify-center gap-2 rounded-md border px-4 py-3 text-sm font-medium transition ${
              type === "individual"
                ? "border-zinc-900 bg-zinc-50 text-zinc-900 ring-1 ring-zinc-900"
                : "border-zinc-200 text-zinc-500 hover:border-zinc-300"
            }`}
          >
            <Icon name="user" className="h-4 w-4" />
            Individual
          </button>
          <button
            type="button"
            onClick={() => setType("company")}
            className={`flex flex-1 items-center justify-center gap-2 rounded-md border px-4 py-3 text-sm font-medium transition ${
              type === "company"
                ? "border-zinc-900 bg-zinc-50 text-zinc-900 ring-1 ring-zinc-900"
                : "border-zinc-200 text-zinc-500 hover:border-zinc-300"
            }`}
          >
            <Icon name="building" className="h-4 w-4" />
            Company
          </button>
        </div>
      )}
      <input type="hidden" name="customer_type" value={type} />

      <Field
        label={type === "company" ? "Company Name" : "Customer Name"}
        name="name"
        defaultValue={customer?.name}
        required
        className="col-span-2"
      />
      <Field label="VAT/TRN Number (if applicable)" name="trn_number" defaultValue={customer?.trn_number ?? ""} />
      <Field label="Mobile No" name="phone" defaultValue={customer?.phone} required />
      <Field label="Landline (optional)" name="landline" defaultValue={customer?.landline ?? ""} />
      {type === "company" ? (
        <Field label="Representative" name="representative" defaultValue={customer?.representative ?? ""} />
      ) : (
        <Field label="Email" name="email" type="email" defaultValue={customer?.email ?? ""} />
      )}
      <Field label="Reference Name" name="reference_name" defaultValue={customer?.reference_name ?? ""} />
      <Field label="Address" name="address" defaultValue={customer?.address ?? ""} />
      <label className="block">
        <span className={labelClass}>City</span>
        <select name="city" defaultValue={customer?.city ?? ""} className={inputClass}>
          <option value="">Select city / emirate...</option>
          {EMIRATES.map((e) => (
            <option key={e} value={e}>
              {e}
            </option>
          ))}
        </select>
      </label>

      {type === "individual" &&
        (companies ? (
          <div className="col-span-2 grid grid-cols-1 gap-4 rounded-lg border border-zinc-200 bg-zinc-50/60 p-4 sm:grid-cols-2">
            <label className="block">
              <span className={labelClass}>Works for a company? (optional)</span>
              <select name="parent_customer_id" value={companyId} onChange={(e) => setCompanyId(e.target.value)} className={inputClass}>
                <option value="">No — private customer</option>
                {companies
                  .filter((c) => c.id !== customer?.id)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
              </select>
            </label>
            <Field label="Job title (optional)" name="job_title" defaultValue={customer?.job_title ?? ""} placeholder="e.g. Driver, Consul" />
            {companyId && showCompanyPays && (
              <label className="col-span-full flex items-start gap-2.5 text-[13px] text-zinc-700">
                <input type="checkbox" name="company_pays" className="mt-0.5 h-4 w-4 accent-zinc-900" />
                <span>
                  <span className="font-medium text-zinc-900">The company pays for this person&apos;s car</span>
                  <span className="block text-xs text-zinc-500">Jobs are billed to the company by default — you can still change it on each job.</span>
                </span>
              </label>
            )}
          </div>
        ) : (
          <>
            <input type="hidden" name="parent_customer_id" value={customer?.parent_customer_id ?? ""} />
            <input type="hidden" name="job_title" value={customer?.job_title ?? ""} />
          </>
        ))}
    </>
  );
}
