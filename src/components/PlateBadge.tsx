const EMIRATE_STYLE: Record<string, { accent: string; arabic: string }> = {
  "Abu Dhabi": { accent: "bg-red-600", arabic: "أبوظبي" },
  Dubai: { accent: "bg-blue-600", arabic: "دبي" },
  Sharjah: { accent: "bg-emerald-600", arabic: "الشارقة" },
  Ajman: { accent: "bg-green-600", arabic: "عجمان" },
  "Umm Al Quwain": { accent: "bg-purple-600", arabic: "أم القيوين" },
  "Ras Al Khaimah": { accent: "bg-orange-500", arabic: "رأس الخيمة" },
  Fujairah: { accent: "bg-teal-600", arabic: "الفجيرة" },
};

const DEFAULT_STYLE = { accent: "bg-blue-600", arabic: "" };

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
  const style = (emirate && EMIRATE_STYLE[emirate]) || DEFAULT_STYLE;
  const { code, number } = splitPlate(plateNumber);

  if (size === "lg") {
    return (
      <span
        className={`inline-flex w-64 flex-col overflow-hidden rounded-lg border-[3px] border-slate-900 bg-white shadow-md ${className}`}
      >
        <span className="flex items-baseline justify-center gap-2 border-b-2 border-slate-900 bg-white px-2 pt-1.5 pb-1">
          <span className="text-sm font-black uppercase tracking-wider text-slate-900">
            {emirate ?? "UAE"}
          </span>
          {style.arabic && (
            <span dir="rtl" className="font-serif text-sm font-bold text-slate-900">
              {style.arabic}
            </span>
          )}
        </span>
        <span className="flex flex-1 items-center justify-center gap-2 px-3 py-2">
          {code && (
            <>
              <span className="font-mono text-3xl font-black tracking-tight text-slate-900">{code}</span>
              <span className="h-8 w-0.5 bg-slate-900" />
            </>
          )}
          <span className="font-mono text-3xl font-black tracking-wider text-slate-900">{number}</span>
        </span>
        <span className={`h-1.5 w-full ${style.accent}`} />
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-stretch overflow-hidden rounded-md border-2 border-slate-900 bg-white shadow-sm ${className}`}
    >
      <span
        className={`flex flex-col items-center justify-center px-1.5 py-0.5 text-[8px] font-bold leading-tight text-white ${style.accent}`}
      >
        <span>UAE</span>
      </span>
      <span className="flex flex-col justify-center px-2 py-0.5">
        {emirate && (
          <span className="text-center text-[8px] font-semibold uppercase tracking-wide text-slate-500">
            {emirate}
          </span>
        )}
        <span className="text-center font-mono text-sm font-extrabold tracking-widest text-slate-900">
          {plateNumber}
        </span>
      </span>
    </span>
  );
}
