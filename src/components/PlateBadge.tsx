const EMIRATE_COLORS: Record<string, { strip: string; label: string }> = {
  "Abu Dhabi": { strip: "bg-red-700", label: "text-red-700" },
  Dubai: { strip: "bg-blue-700", label: "text-blue-700" },
  Sharjah: { strip: "bg-emerald-700", label: "text-emerald-700" },
  Ajman: { strip: "bg-green-700", label: "text-green-700" },
  "Umm Al Quwain": { strip: "bg-purple-700", label: "text-purple-700" },
  "Ras Al Khaimah": { strip: "bg-orange-600", label: "text-orange-600" },
  Fujairah: { strip: "bg-teal-700", label: "text-teal-700" },
};

const DEFAULT_COLORS = { strip: "bg-blue-700", label: "text-blue-700" };

export function PlateBadge({
  plateNumber,
  emirate,
  className = "",
}: {
  plateNumber: string;
  emirate?: string;
  className?: string;
}) {
  const colors = (emirate && EMIRATE_COLORS[emirate]) || DEFAULT_COLORS;

  return (
    <span
      className={`inline-flex items-stretch overflow-hidden rounded-md border-2 border-slate-900 bg-white shadow-sm ${className}`}
    >
      <span className={`flex flex-col items-center justify-center px-1.5 py-0.5 text-[8px] font-bold leading-tight text-white ${colors.strip}`}>
        <span>UAE</span>
      </span>
      <span className="flex flex-col justify-center px-2 py-0.5">
        {emirate && (
          <span className={`text-center text-[8px] font-semibold uppercase tracking-wide ${colors.label}`}>
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
