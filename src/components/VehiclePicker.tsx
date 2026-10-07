"use client";

import { useState } from "react";
import { labelClass, inputClass } from "@/components/ui";
import { Icon } from "@/components/icons";

export type VehicleOptionData = {
  id: string;
  customerId: string;
  label: string;
  ownerName: string;
  hasWarranty: boolean;
  company: { id: string; name: string } | null;
  companyPays: boolean;
};

/**
 * Vehicle select for a new job card. For an employee's car it also asks who pays:
 * the company (job billed to the company) or the employee — preset from the car's setting.
 */
export function VehiclePicker({ vehicles }: { vehicles: VehicleOptionData[] }) {
  const [value, setValue] = useState("");
  const selected = vehicles.find((v) => `${v.id}::${v.customerId}` === value);
  const [payer, setPayer] = useState<string>("");

  function choose(next: string) {
    setValue(next);
    const v = vehicles.find((x) => `${x.id}::${x.customerId}` === next);
    setPayer(v?.company && v.companyPays ? v.company.id : v?.customerId ?? "");
  }

  return (
    <div className="space-y-4">
      <label className="block">
        <span className={labelClass}>
          Vehicle <span className="text-brand-600">*</span>
        </span>
        <select name="vehicle_customer" required value={value} onChange={(e) => choose(e.target.value)} className={inputClass}>
          <option value="">Select a vehicle...</option>
          {vehicles.map((v) => (
            <option key={v.id} value={`${v.id}::${v.customerId}`}>
              {v.hasWarranty ? "[Warranty] " : ""}
              {v.label} ({v.ownerName}
              {v.company ? ` · ${v.company.name}` : ""})
            </option>
          ))}
        </select>
      </label>

      {selected?.company && (
        <fieldset className="rounded-lg border border-zinc-200 bg-zinc-50/60 p-4">
          <legend className="sr-only">Who pays for this job</legend>
          <p className="mb-3 flex items-center gap-1.5 text-[13px] font-medium text-zinc-900">
            <Icon name="wallet" className="h-4 w-4 text-zinc-400" />
            Who pays for this job?
          </p>
          <input type="hidden" name="bill_to" value={payer} />
          <div className="grid gap-2 sm:grid-cols-2">
            {[
              { id: selected.company.id, title: selected.company.name, text: `Company account · ${selected.ownerName} brought the car`, icon: "building" as const },
              { id: selected.customerId, title: selected.ownerName, text: "Employee pays personally", icon: "user" as const },
            ].map((o) => {
              const on = payer === o.id;
              return (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => setPayer(o.id)}
                  aria-pressed={on}
                  className={`flex items-start gap-3 rounded-md border bg-white p-3 text-left transition ${on ? "border-zinc-900 ring-1 ring-zinc-900" : "border-zinc-200 hover:border-zinc-300"}`}
                >
                  <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${on ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-500"}`}>
                    <Icon name={o.icon} className="h-3.5 w-3.5" />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-[13px] font-medium text-zinc-900">{o.title}</span>
                    <span className="block text-xs text-zinc-500">{o.text}</span>
                  </span>
                </button>
              );
            })}
          </div>
          <p className="mt-2.5 text-xs text-zinc-500">
            Preset from this car&apos;s setting ({selected.companyPays ? "company pays" : "employee pays"}). The invoice goes to whoever you pick.
          </p>
        </fieldset>
      )}
    </div>
  );
}
