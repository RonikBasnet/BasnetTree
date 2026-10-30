import NepaliDate from "nepali-date-converter";

// Formats a stored AD ISO date ("YYYY-MM-DD") as a Bikram Sambat date string for display.
export function formatBsDate(isoDate?: string): string | undefined {
  if (!isoDate) return undefined;
  const [y, m, d] = isoDate.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return undefined;
  return new NepaliDate(new Date(y, m - 1, d)).format("DD MMMM YYYY");
}

// Formats just the BS year, used for compact "1974 - 2025" style ranges.
export function formatBsYear(isoDate?: string): string | undefined {
  if (!isoDate) return undefined;
  const [y, m, d] = isoDate.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return undefined;
  return String(new NepaliDate(new Date(y, m - 1, d)).getYear());
}
