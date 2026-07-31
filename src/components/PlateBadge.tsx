import { EmirateLogo } from "@/components/EmirateLogo";

function splitPlate(plateNumber: string) {
  const match = plateNumber.trim().match(/^([A-Z0-9]{1,3})\s+(\d{1,5})$/i);
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
  const { code, number } = splitPlate(plateNumber);
  const isLg = size === "lg";

  return (
    <span
      className={`inline-flex w-fit items-center overflow-hidden whitespace-nowrap rounded-md border-[3px] border-slate-900 bg-[#f2f2f2] ${
        isLg ? "h-16 gap-3 px-3" : "h-7 gap-1.5 px-1.5"
      } ${className}`}
    >
      {code && (
        <span className={`shrink-0 font-sans font-black leading-none text-slate-900 ${isLg ? "text-4xl" : "text-sm"}`}>
          {code}
        </span>
      )}
      {emirate && (
        <span className="flex shrink-0 items-center justify-center">
          <EmirateLogo emirate={emirate} size={isLg ? "md" : "xs"} />
        </span>
      )}
      <span className={`shrink-0 font-sans font-black leading-none text-slate-900 ${isLg ? "text-4xl" : "text-base"}`}>
        {number}
      </span>
    </span>
  );
}
