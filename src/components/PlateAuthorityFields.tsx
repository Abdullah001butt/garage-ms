"use client";

import { useState } from "react";
import { labelClass, inputClass } from "@/components/ui";
import { EMIRATES } from "@/lib/plate";
import { EmirateLogo } from "@/components/EmirateLogo";
import { PlateBadge } from "@/components/PlateBadge";

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
  const initial = splitPlate(plateNumber);
  const [selectedEmirate, setSelectedEmirate] = useState(emirate ?? "Ajman");
  const [code, setCode] = useState(initial.code);
  const [digits, setDigits] = useState(initial.digits);

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
        <div className="mt-2 flex h-9 items-center rounded-md border border-slate-200 bg-[#f2f2f2] px-2">
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
          value={digits}
          onChange={(e) => setDigits(e.target.value.replace(/\D/g, ""))}
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
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          required={required}
          className={inputClass}
        />
      </label>

      <div className="col-span-full">
        <span className={labelClass}>Live Preview</span>
        <div className="mt-2 flex items-center justify-center rounded-lg border border-dashed border-slate-300 bg-[#f2f2f2] p-4">
          <PlateBadge plateNumber={`${code} ${digits}`.trim() || "A 00000"} emirate={selectedEmirate} size="lg" />
        </div>
      </div>
    </>
  );
}
