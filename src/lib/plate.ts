export const EMIRATES = [
  "Abu Dhabi",
  "Dubai",
  "Sharjah",
  "Ajman",
  "Umm Al Quwain",
  "Ras Al Khaimah",
  "Fujairah",
] as const;

// UAE plates are "code" (1-3 letters, or a 1-2 digit category number) + up to 5 digits,
// e.g. "A 12345", "DXB 1234", "12 4567".
export const PLATE_PATTERN = "^[A-Za-z]{1,3}[\\s-]?\\d{1,5}$|^\\d{1,2}[\\s-]?\\d{1,5}$";
const PLATE_REGEX = new RegExp(PLATE_PATTERN);

export function isValidPlateNumber(value: string) {
  return PLATE_REGEX.test(value.trim());
}

export function normalizePlateNumber(raw: string) {
  const trimmed = raw.trim().toUpperCase().replace(/\s+/g, " ");
  const match = trimmed.match(/^([A-Z0-9]{1,3})[\s-]?(\d{1,5})$/);
  if (!match) return trimmed;
  return `${match[1]} ${match[2]}`;
}
