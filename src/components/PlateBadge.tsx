const EMIRATE_STYLE: Record<string, { accent: string; arabic: string; abbr: string }> = {
  "Abu Dhabi": { accent: "bg-red-600", arabic: "أبوظبي", abbr: "AUH" },
  Dubai: { accent: "bg-blue-600", arabic: "دبي", abbr: "DXB" },
  Sharjah: { accent: "bg-emerald-600", arabic: "الشارقة", abbr: "SHJ" },
  Ajman: { accent: "bg-green-600", arabic: "عجمان", abbr: "AJM" },
  "Umm Al Quwain": { accent: "bg-purple-600", arabic: "أم القيوين", abbr: "UAQ" },
  "Ras Al Khaimah": { accent: "bg-orange-500", arabic: "رأس الخيمة", abbr: "RAK" },
  Fujairah: { accent: "bg-teal-600", arabic: "الفجيرة", abbr: "FUJ" },
};

const DEFAULT_STYLE = { accent: "bg-blue-600", arabic: "", abbr: "UAE" };

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
  const isLg = size === "lg";

  return (
    <span
      className={`inline-flex items-stretch overflow-hidden rounded-md border-2 border-slate-900 bg-white shadow-sm ${
        isLg ? "h-16 w-72" : "h-7 w-32"
      } ${className}`}
    >
      {/* Emirate emblem strip */}
      <span
        className={`flex flex-col items-center justify-center gap-0.5 border-r-2 border-slate-900 bg-white ${
          isLg ? "w-16 px-1" : "w-7 px-0.5"
        }`}
      >
        <span
          className={`flex items-center justify-center rounded-full text-white ${style.accent} ${
            isLg ? "h-6 w-6 text-[9px] font-bold" : "h-3 w-3 text-[5px] font-bold"
          }`}
        >
          {isLg ? style.abbr.slice(0, 2) : ""}
        </span>
        {isLg ? (
          <>
            <span className="text-center text-[9px] font-bold uppercase leading-none text-slate-900">
              {emirate ?? "UAE"}
            </span>
            {style.arabic && (
              <span dir="rtl" className="text-center font-serif text-[10px] font-bold leading-none text-slate-900">
                {style.arabic}
              </span>
            )}
          </>
        ) : (
          <span className="text-center text-[4px] font-bold uppercase leading-none text-slate-700">
            {style.abbr}
          </span>
        )}
      </span>

      {/* Plate number */}
      <span className="flex flex-1 items-center justify-center gap-1.5 px-2">
        {code && (
          <>
            <span
              className={`font-sans font-black tracking-tight text-slate-900 ${isLg ? "text-2xl" : "text-xs"}`}
            >
              {code}
            </span>
            <span className={`bg-slate-900 ${isLg ? "h-8 w-0.5" : "h-3.5 w-px"}`} />
          </>
        )}
        <span className={`font-sans font-black tracking-wider text-slate-900 ${isLg ? "text-2xl" : "text-xs"}`}>
          {number}
        </span>
      </span>
    </span>
  );
}
