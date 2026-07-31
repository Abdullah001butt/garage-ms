"use client";

import { useState } from "react";
import { labelClass, inputClass } from "@/components/ui";
import { EMIRATES } from "@/lib/plate";
import { EmirateLogo } from "@/components/EmirateLogo";

function splitPlate(plateNumber?: string) {
  const match = (plateNumber ?? "").trim().match(/^([A-Za-z0-9]{1,3})\s?(\d{1,5})$/);
  if (!match) return { code: "", digits: "" };
  return { code: match[1].toUpperCase(), digits: match[2] };
}

export function PlateAuthorityFields({
  plateNumber,
  emirate,
  required = false,
}: {
  plateNumber?: string;
  emirate?: string;
  required?: boolean;
}) {
  const { code, digits } = splitPlate(plateNumber);
  const [selectedEmirate, setSelectedEmirate] = useState(emirate ?? "Ajman");

  return (
    <>
      <label className="block">
        <span className={labelClass}>Plate Issuing Authority</span>
        <select
          name="emirate"
          value={selectedEmirate}
          onChange={(e) => setSelectedEmirate(e.target.value)}
          className={inputClass}
        >
          {EMIRATES.map((e) => (
            <option key={e} value={e}>
              {e}
            </option>
          ))}
        </select>
        <div className="mt-2 flex h-9 items-center rounded-md border border-slate-200 bg-slate-50 px-2">
          <EmirateLogo emirate={selectedEmirate} size="sm" />
        </div>
      </label>

      <label className="block">
        <span className={labelClass}>Plate Number</span>
        <input
          type="text"
          name="plate_digits"
          inputMode="numeric"
          placeholder="12345"
          defaultValue={digits}
          required={required}
          className={inputClass}
        />
      </label>

      <label className="block">
        <span className={labelClass}>Plate Code</span>
        <input
          type="text"
          name="plate_code"
          placeholder="A"
          defaultValue={code}
          required={required}
          className={inputClass}
        />
      </label>
    </>
  );
}
