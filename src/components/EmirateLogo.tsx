import Image from "next/image";

const LOGO_FILE: Record<string, string> = {
  "Abu Dhabi": "abu-dhabi.png",
  Dubai: "dubai.png",
  Sharjah: "sharjah.png",
  Ajman: "ajman.png",
  "Umm Al Quwain": "umm-al-quwain.png",
  "Ras Al Khaimah": "ras-al-khaimah.png",
  Fujairah: "fujairah.png",
};

const SIZES = {
  xs: { w: 40, h: 14, className: "h-3.5 w-auto object-contain" },
  sm: { w: 80, h: 28, className: "h-7 w-auto object-contain" },
  md: { w: 120, h: 40, className: "h-10 w-auto object-contain" },
};

export function EmirateLogo({ emirate, size = "sm" }: { emirate: string; size?: "xs" | "sm" | "md" }) {
  const file = LOGO_FILE[emirate];
  if (!file) return null;
  const { w, h, className } = SIZES[size];

  return (
    <Image
      src={`/emirate-logos/${file}`}
      alt={`${emirate} plate issuing authority`}
      width={w}
      height={h}
      className={className}
      unoptimized
    />
  );
}
