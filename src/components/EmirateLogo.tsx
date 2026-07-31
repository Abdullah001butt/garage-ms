import type { ReactElement } from "react";

const STYLES: Record<
  string,
  { render: (size: "sm" | "md") => ReactElement }
> = {
  "Abu Dhabi": {
    render: (size) => (
      <span className="inline-flex items-center gap-1.5">
        <span
          className={`flex items-center justify-center rounded-[40%] bg-[#c1272d] text-white ${
            size === "md" ? "h-9 w-9 text-[10px]" : "h-6 w-6 text-[7px]"
          }`}
          style={{ clipPath: "polygon(50% 0%, 100% 20%, 100% 100%, 0% 100%, 0% 20%)" }}
        >
          <span dir="rtl" className="font-serif leading-none">
            أبو
          </span>
        </span>
        <span className="flex flex-col leading-none">
          <span className={`font-semibold italic text-[#c1272d] ${size === "md" ? "text-sm" : "text-[10px]"}`}>
            AbuDhabi
          </span>
          <span className="flex items-center gap-1 text-[8px] font-medium text-slate-500">
            <span dir="rtl">الامارات</span>
            <span>U.A.E</span>
          </span>
        </span>
      </span>
    ),
  },
  Dubai: {
    render: (size) => (
      <span className={`font-black uppercase tracking-tight text-slate-700 ${size === "md" ? "text-xl" : "text-sm"}`}>
        DUBAI
      </span>
    ),
  },
  Sharjah: {
    render: (size) => (
      <span className="flex flex-col items-center leading-none text-slate-700">
        <span dir="rtl" className={`font-serif font-bold ${size === "md" ? "text-lg" : "text-xs"}`}>
          الشـــارقة
        </span>
        <span className="text-[8px] font-semibold tracking-wide">U.A.E &nbsp; ٥٠٤١</span>
        <span className={`font-bold tracking-widest ${size === "md" ? "text-[10px]" : "text-[7px]"}`}>SHARJAH</span>
      </span>
    ),
  },
  Ajman: {
    render: (size) => (
      <span className="flex flex-col items-center leading-none text-slate-700">
        <span dir="rtl" className={`font-serif font-bold ${size === "md" ? "text-sm" : "text-[10px]"}`}>
          الإمـــارات
        </span>
        <span className="text-[8px] font-semibold tracking-wide">UAE AJMAN</span>
        <span dir="rtl" className={`font-serif font-bold ${size === "md" ? "text-sm" : "text-[10px]"}`}>
          عجـــمان
        </span>
      </span>
    ),
  },
  "Umm Al Quwain": {
    render: (size) => (
      <span className="flex flex-col items-center leading-none text-slate-700">
        <span className={`font-black tracking-widest ${size === "md" ? "text-base" : "text-[10px]"}`}>U A E</span>
        <span dir="rtl" className={`font-serif font-bold ${size === "md" ? "text-sm" : "text-[10px]"}`}>
          ام القيوين
        </span>
      </span>
    ),
  },
  "Ras Al Khaimah": {
    render: (size) => (
      <span className="flex flex-col items-center leading-none text-slate-700">
        <span dir="rtl" className={`font-serif font-bold ${size === "md" ? "text-xs" : "text-[9px]"}`}>
          الإمـارات
        </span>
        <span dir="rtl" className={`font-serif font-bold ${size === "md" ? "text-xs" : "text-[9px]"}`}>
          رأس الخيمة
        </span>
        <span className={`font-bold tracking-wide ${size === "md" ? "text-[10px]" : "text-[7px]"}`}>UAE-RAK</span>
      </span>
    ),
  },
  Fujairah: {
    render: (size) => (
      <span className="flex flex-col items-center leading-none text-slate-700">
        <span className={`font-black tracking-widest ${size === "md" ? "text-base" : "text-[10px]"}`}>U.A.E</span>
        <span dir="rtl" className={`font-serif font-bold ${size === "md" ? "text-sm" : "text-[10px]"}`}>
          الـفـجـيرة
        </span>
      </span>
    ),
  },
};

export function EmirateLogo({ emirate, size = "sm" }: { emirate: string; size?: "sm" | "md" }) {
  const entry = STYLES[emirate];
  if (!entry) return null;
  return entry.render(size);
}
