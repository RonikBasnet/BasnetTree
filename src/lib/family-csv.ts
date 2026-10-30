import NepaliDate from "nepali-date-converter";
import { Person } from "@/models/Person";
import { parseCsv, toCsv } from "@/lib/csv";
import { applyBirthOrder } from "@/lib/sibling-order";
import { syncSpouseLinks } from "@/lib/spouse-links";

// CSV layout. `parents`/`spouses` hold `id` values separated by ";" (an exact,
// unique name also works, which is handy for hand-written files). Dates are
// Bikram Sambat "YYYY-MM-DD"; the AD columns are a fallback used when the BS
// cell is blank. parentNames/spouseNames are for reading only and ignored on import.
const COLUMNS = [
  "id",
  "name",
  "gender",
  "birthDateBS",
  "deathDateBS",
  "birthDateAD",
  "deathDateAD",
  "birthOrder",
  "parents",
  "spouses",
  "parentNames",
  "spouseNames",
  "bio",
  "photoUrl",
] as const;

const pad = (n: number) => String(n).padStart(2, "0");

function adToBs(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const bs = new NepaliDate(new Date(y, m - 1, d));
  return `${bs.getYear()}-${pad(bs.getMonth() + 1)}-${pad(bs.getDate())}`;
}

function bsToAd(bsDate: string): string | null {
  const match = bsDate.trim().match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (!match) return null;
  try {
    const ad = new NepaliDate(Number(match[1]), Number(match[2]) - 1, Number(match[3])).getAD();
    return `${ad.year}-${pad(ad.month + 1)}-${pad(ad.date)}`;
  } catch {
    return null;
  }
}

function parseAd(adDate: string): string | null {
  const match = adDate.trim().match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  return match ? `${match[1]}-${pad(Number(match[2]))}-${pad(Number(match[3]))}` : null;
}

function parseGender(value: string): "male" | "female" | "other" {
  const v = value.trim().toLowerCase();
  if (v === "male" || v === "m") return "male";
  if (v === "female" || v === "f") return "female";
  return "other";
}

const splitRefs = (value: string) =>
  value
    .split(";")
    .map((ref) => ref.trim())
    .filter(Boolean);

export async function exportFamilyCsv(familyId: string): Promise<string> {
  const docs = await Person.find({ familyId }).lean();
  const nameById = new Map(docs.map((p) => [String(p._id), p.name]));
  const isoDay = (date?: Date | null) => (date ? date.toISOString().slice(0, 10) : "");

  const rows = docs.map((p) => {
    const parents = (p.parents ?? []).map(String).filter((id) => nameById.has(id));
    const spouses = (p.spouses ?? []).map(String).filter((id) => nameById.has(id));
    const birthAd = isoDay(p.birthDate);
    const deathAd = isoDay(p.deathDate);
    return [
      String(p._id),
      p.name,
      p.gender,
      birthAd && adToBs(birthAd),
      deathAd && adToBs(deathAd),
      birthAd,
      deathAd,
      parents.length > 0 ? p.order ?? "" : "",
      parents.join(";"),
      spouses.join(";"),
      parents.map((id) => nameById.get(id)).join("; "),
      spouses.map((id) => nameById.get(id)).join("; "),
      p.bio ?? "",
      p.photoUrl ?? "",
    ];
  });

  return toCsv([[...COLUMNS], ...rows]);
}

export interface ImportResult {
  created: number;
  updated: number;
  warnings: string[];
}

// Imports rows into a family. A row whose `id` matches an existing person in
// this family updates them; any other row creates a new person (its `id` can be
// any label, e.g. "p1", for other rows to reference). Nobody is ever deleted.
export async function importFamilyCsv(familyId: string, text: string): Promise<ImportResult> {
  const [header, ...dataRows] = parseCsv(text);
  if (!header) throw new Error("The CSV file is empty.");
  const columnIndex = new Map(header.map((name, i) => [name.trim(), i]));
  if (!columnIndex.has("name")) throw new Error('The CSV needs at least a "name" column.');
  const cell = (row: string[], column: (typeof COLUMNS)[number]) => {
    const i = columnIndex.get(column);
    return i === undefined ? "" : (row[i] ?? "").trim();
  };
  const hasColumn = (column: (typeof COLUMNS)[number]) => columnIndex.has(column);

  const warnings: string[] = [];
  const existing = await Person.find({ familyId }).lean();
  const existingIds = new Set(existing.map((p) => String(p._id)));

  // Pass 1: create/update people (without relationships) and map row ids to database ids.
  const idByRef = new Map<string, string>();
  const imported: { row: string[]; line: number; personId: string; isNew: boolean }[] = [];
  let created = 0;
  let updated = 0;

  for (const [index, row] of dataRows.entries()) {
    const line = index + 2;
    const name = cell(row, "name");
    if (!name) {
      warnings.push(`Line ${line}: skipped, no name.`);
      continue;
    }

    const dates: { birthDate?: string | null; deathDate?: string | null } = {};
    for (const [field, bsColumn, adColumn] of [
      ["birthDate", "birthDateBS", "birthDateAD"],
      ["deathDate", "deathDateBS", "deathDateAD"],
    ] as const) {
      if (!hasColumn(bsColumn) && !hasColumn(adColumn)) continue;
      const bs = cell(row, bsColumn);
      const ad = cell(row, adColumn);
      const value = bs ? bsToAd(bs) : ad ? parseAd(ad) : null;
      if ((bs || ad) && !value) warnings.push(`Line ${line}: couldn't read ${bs ? bsColumn : adColumn} "${bs || ad}".`);
      dates[field] = value;
    }

    const fields = {
      name,
      ...(hasColumn("gender") ? { gender: parseGender(cell(row, "gender")) } : {}),
      ...dates,
      ...(hasColumn("bio") ? { bio: cell(row, "bio") || null } : {}),
      ...(hasColumn("photoUrl") ? { photoUrl: cell(row, "photoUrl") || null } : {}),
    };

    const ref = cell(row, "id");
    if (ref && idByRef.has(ref)) {
      warnings.push(`Line ${line}: skipped, duplicate id "${ref}".`);
      continue;
    }
    let personId: string;
    const isNew = !(ref && existingIds.has(ref));
    if (isNew) {
      const person = await Person.create({ gender: "other", ...fields, familyId });
      personId = String(person._id);
      created++;
    } else {
      personId = ref;
      await Person.updateOne({ _id: personId }, fields);
      updated++;
    }
    if (ref) idByRef.set(ref, personId);
    imported.push({ row, line, personId, isNew });
  }

  // References resolve to a row id, an existing person's id, or a unique name.
  const people = await Person.find({ familyId }).select("name spouses").lean();
  const idsByName = new Map<string, string[]>();
  for (const p of people) {
    const key = p.name.trim().toLowerCase();
    idsByName.set(key, [...(idsByName.get(key) ?? []), String(p._id)]);
  }
  const spousesBefore = new Map(people.map((p) => [String(p._id), (p.spouses ?? []).map(String)]));
  const resolve = (ref: string, line: number): string | null => {
    const byRef = idByRef.get(ref) ?? (existingIds.has(ref) ? ref : undefined);
    if (byRef) return byRef;
    const byName = idsByName.get(ref.toLowerCase()) ?? [];
    if (byName.length === 1) return byName[0];
    warnings.push(
      `Line ${line}: ${byName.length > 1 ? `"${ref}" matches several people` : `couldn't find "${ref}"`}, link skipped.`
    );
    return null;
  };

  // Pass 2: relationships, with spouse links kept two-way.
  for (const { row, line, personId } of imported) {
    const update: { parents?: string[]; spouses?: string[] } = {};
    if (hasColumn("parents")) {
      update.parents = splitRefs(cell(row, "parents"))
        .map((ref) => resolve(ref, line))
        .filter((id): id is string => id !== null && id !== personId);
    }
    if (hasColumn("spouses")) {
      update.spouses = splitRefs(cell(row, "spouses"))
        .map((ref) => resolve(ref, line))
        .filter((id): id is string => id !== null && id !== personId);
    }
    if (Object.keys(update).length === 0) continue;
    await Person.updateOne({ _id: personId }, update);
    if (update.spouses) {
      await syncSpouseLinks(personId, spousesBefore.get(personId) ?? [], update.spouses);
    }
  }

  // Pass 3: birth order. Applied in ascending order so each sibling group ends up
  // numbered 1..n as given; rows without an order keep their place (new ones go last).
  const ordered = imported
    .map((entry) => ({ ...entry, order: Number.parseInt(cell(entry.row, "birthOrder"), 10) }))
    .sort((a, b) => (Number.isNaN(a.order) ? Infinity : a.order) - (Number.isNaN(b.order) ? Infinity : b.order));
  for (const { personId, order, isNew } of ordered) {
    if (!Number.isNaN(order)) await applyBirthOrder(familyId, personId, order);
    else if (isNew) await applyBirthOrder(familyId, personId);
  }

  return { created, updated, warnings };
}
