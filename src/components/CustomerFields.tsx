"use client";

import { Icon } from "@/components/icons";
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
    </>
  );
}
