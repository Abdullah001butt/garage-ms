"use client";

import { useState } from "react";
import type { JobTemplate } from "@/lib/types";
import { labelClass, inputClass } from "@/components/ui";

export function JobDescriptionField({ templates }: { templates: JobTemplate[] }) {
  const [value, setValue] = useState("");

  return (
    <div>
      {templates.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2">
          {templates.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setValue(t.description)}
              className="rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-100"
            >
              {t.name}
            </button>
          ))}
        </div>
      )}
      <label className="block">
        <span className={labelClass}>
          Description <span className="text-red-500">*</span>
        </span>
        <textarea
          name="description"
          required
          rows={3}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="e.g. Oil change, brake pad replacement — or tap a template above"
          className={inputClass}
        />
      </label>
    </div>
  );
}
