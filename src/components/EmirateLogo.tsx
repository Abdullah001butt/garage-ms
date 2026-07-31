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

export function EmirateLogo({ emirate, size = "sm" }: { emirate: string; size?: "sm" | "md" }) {
  const file = LOGO_FILE[emirate];
  if (!file) return null;

  return (
    <Image
      src={`/emirate-logos/${file}`}
      alt={`${emirate} plate issuing authority`}
      width={size === "md" ? 120 : 80}
      height={size === "md" ? 40 : 28}
      className={size === "md" ? "h-10 w-auto object-contain" : "h-7 w-auto object-contain"}
      unoptimized
    />
  );
}
