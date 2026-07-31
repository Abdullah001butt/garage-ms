const EMIRATE_LABEL: Record<string, { arabic: string; abbr: string }> = {
  "Abu Dhabi": { arabic: "أبوظبي", abbr: "UAE.AD" },
  Dubai: { arabic: "دبي", abbr: "DUBAI" },
  Sharjah: { arabic: "الشارقة", abbr: "UAE.SHJ" },
  Ajman: { arabic: "عجمان", abbr: "UAE.AJMAN" },
  "Umm Al Quwain": { arabic: "ام القيوين", abbr: "UAE.UAQ" },
  "Ras Al Khaimah": { arabic: "رأس الخيمة", abbr: "UAE.RAK" },
  Fujairah: { arabic: "الفجيرة", abbr: "UAE.FUJ" },
};

const DEFAULT_LABEL = { arabic: "", abbr: "UAE" };

function splitPlate(plateNumber: string) {
  const match = plateNumber.trim().match(/^([A-Z0-9]{1,3})\s?(\d{1,5})$/i);
  if (!match) return { code: null, number: plateNumber };
  return { code: match[1].toUpperCase(), number: match[2] };
}

export function PlateBadge({
  plateNumber,
  emirate,
  size = "sm",
  className = "",
}: {
  plateNumber: string;
  emirate?: string;
  size?: "sm" | "lg";
  className?: string;
}) {
  const label = (emirate && EMIRATE_LABEL[emirate]) || DEFAULT_LABEL;
  const { code, number } = splitPlate(plateNumber);
  const isLg = size === "lg";

  return (
    <span
      className={`inline-flex items-center overflow-hidden rounded-md border-[3px] border-slate-900 bg-white ${
        isLg ? "h-16 gap-2 px-3" : "h-7 gap-1 px-1.5"
      } ${className}`}
    >
      {code && (
        <span className={`font-sans font-black leading-none text-slate-900 ${isLg ? "text-4xl" : "text-sm"}`}>
          {code}
        </span>
      )}
      <span className="flex flex-col items-start justify-center leading-none">
        {label.arabic && (
          <span dir="rtl" className={`font-serif font-bold text-slate-900 ${isLg ? "text-sm" : "text-[6px]"}`}>
            {label.arabic}
          </span>
        )}
        <span className={`font-bold uppercase tracking-tight text-slate-900 ${isLg ? "text-[10px]" : "text-[5px]"}`}>
          {label.abbr}
        </span>
      </span>
      <span className={`flex-1 text-center font-sans font-black tracking-wide text-slate-900 ${isLg ? "text-4xl" : "text-base"}`}>
        {number}
      </span>
    </span>
  );
}
