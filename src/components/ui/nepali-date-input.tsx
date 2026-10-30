"use client";

import { useMemo } from "react";
import NepaliDate, { dateConfigMap } from "nepali-date-converter";
import { Select } from "@/components/ui/select";

const BS_MONTHS = [
  "Baisakh",
  "Jestha",
  "Asar",
  "Shrawan",
  "Bhadra",
  "Aswin",
  "Kartik",
  "Mangsir",
  "Poush",
  "Magh",
  "Falgun",
  "Chaitra",
] as const;

// The conversion library only ships day-count data for BS 2000-2090.
const MIN_BS_YEAR = 2000;
const MAX_BS_YEAR = 2090;

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function adToBs(isoDate?: string): { year: number; month: number; date: number } | null {
  if (!isoDate) return null;
  const [y, m, d] = isoDate.split("-").map(Number);
  if (!y || !m || !d) return null;
  const nepaliDate = new NepaliDate(new Date(y, m - 1, d));
  return { year: nepaliDate.getYear(), month: nepaliDate.getMonth(), date: nepaliDate.getDate() };
}

function bsToIso(year: number, month: number, date: number): string {
  const ad = new NepaliDate(year, month, date).getAD();
  return `${ad.year}-${pad(ad.month + 1)}-${pad(ad.date)}`;
}

interface NepaliDateInputProps {
  id?: string;
  value?: string;
  onChange: (isoDate: string) => void;
}

// Birth/death dates are entered in the Bikram Sambat calendar, then converted
// to a standard AD ISO date for storage so the rest of the app is unaffected.
export function NepaliDateInput({ id, value, onChange }: NepaliDateInputProps) {
  const bs = useMemo(() => adToBs(value), [value]);

  const daysInMonth = useMemo(() => {
    if (!bs) return 32;
    const yearConfig = dateConfigMap[String(bs.year)];
    return yearConfig ? yearConfig[BS_MONTHS[bs.month]] : 32;
  }, [bs]);

  const years = useMemo(
    () => Array.from({ length: MAX_BS_YEAR - MIN_BS_YEAR + 1 }, (_, i) => MAX_BS_YEAR - i),
    []
  );
  const days = useMemo(() => Array.from({ length: daysInMonth }, (_, i) => i + 1), [daysInMonth]);

  function update(part: "year" | "month" | "date", raw: string) {
    if (raw === "") return;
    const base = bs ?? { year: new NepaliDate().getYear(), month: 0, date: 1 };
    const next = { ...base, [part]: Number(raw) };
    onChange(bsToIso(next.year, next.month, next.date));
  }

  return (
    <div id={id} className="grid grid-cols-3 gap-2">
      <Select value={bs?.date ?? ""} onChange={(e) => update("date", e.target.value)}>
        <option value="">Day</option>
        {days.map((d) => (
          <option key={d} value={d}>
            {d}
          </option>
        ))}
      </Select>
      <Select value={bs?.month ?? ""} onChange={(e) => update("month", e.target.value)}>
        <option value="">Month</option>
        {BS_MONTHS.map((name, index) => (
          <option key={name} value={index}>
            {name}
          </option>
        ))}
      </Select>
      <Select value={bs?.year ?? ""} onChange={(e) => update("year", e.target.value)}>
        <option value="">Year (BS)</option>
        {years.map((y) => (
          <option key={y} value={y}>
            {y}
          </option>
        ))}
      </Select>
    </div>
  );
}
