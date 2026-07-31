"use client";

import { useState } from "react";
import { Field, labelClass, inputClass } from "@/components/ui";
import { EMIRATES } from "@/lib/plate";
import type { Customer, CustomerType } from "@/lib/types";

export function CustomerFields({
  customer,
  lockType = false,
}: {
  customer?: Customer;
  lockType?: boolean;
}) {
  const [type, setType] = useState<CustomerType>(customer?.customer_type ?? "individual");

  return (
    <>
      {!lockType && (
        <div className="col-span-2 mb-2 flex gap-2">
          <button
            type="button"
            onClick={() => setType("individual")}
            className={`flex-1 rounded-lg border px-4 py-3 text-sm font-medium transition ${
              type === "individual"
                ? "border-indigo-600 bg-indigo-50 text-indigo-700"
                : "border-slate-200 text-slate-500 hover:border-slate-300"
            }`}
          >
            👤 Individual
          </button>
          <button
            type="button"
            onClick={() => setType("company")}
            className={`flex-1 rounded-lg border px-4 py-3 text-sm font-medium transition ${
              type === "company"
                ? "border-indigo-600 bg-indigo-50 text-indigo-700"
                : "border-slate-200 text-slate-500 hover:border-slate-300"
            }`}
          >
            🏢 Company
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
    </>
  );
}
