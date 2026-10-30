import type { PersonData } from "@/types/models";

type SiblingFields = Pick<PersonData, "_id" | "parents" | "order" | "birthDate" | "name">;

// Birth-order comparator: explicit `order` first, then birth date, then name, so
// duplicate orders (e.g. two siblings both entered as 1) still sort deterministically.
export function compareBirthOrder(a: SiblingFields, b: SiblingFields): number {
  const orderA = a.order ?? 0;
  const orderB = b.order ?? 0;
  if (orderA !== orderB) return orderA - orderB;
  const dateA = a.birthDate ?? "";
  const dateB = b.birthDate ?? "";
  if (dateA !== dateB) {
    if (!dateA) return 1;
    if (!dateB) return -1;
    return dateA < dateB ? -1 : 1;
  }
  return a.name.localeCompare(b.name);
}

// Siblings are people sharing at least one parent (so half-siblings count too,
// e.g. a child recorded with only the father next to one with both parents).
// Returns a map from each person's id to their sibling group, sorted by birth
// order. People with no recorded parents are not in the map.
export function computeSiblingGroups<T extends SiblingFields>(people: T[]): Map<string, T[]> {
  const ids = new Set(people.map((p) => p._id));
  const root = new Map<string, string>();
  const find = (id: string): string => {
    let r = id;
    while (root.get(r) !== r) r = root.get(r)!;
    root.set(id, r);
    return r;
  };

  const firstChildOfParent = new Map<string, string>();
  for (const person of people) {
    const validParents = person.parents.filter((id) => ids.has(id));
    if (validParents.length === 0) continue;
    root.set(person._id, person._id);
    for (const parentId of validParents) {
      const other = firstChildOfParent.get(parentId);
      if (other === undefined) firstChildOfParent.set(parentId, person._id);
      else root.set(find(person._id), find(other));
    }
  }

  const byRoot = new Map<string, T[]>();
  for (const person of people) {
    if (!root.has(person._id)) continue;
    const key = find(person._id);
    const group = byRoot.get(key) ?? [];
    group.push(person);
    byRoot.set(key, group);
  }

  const groups = new Map<string, T[]>();
  for (const group of byRoot.values()) {
    group.sort(compareBirthOrder);
    for (const person of group) groups.set(person._id, group);
  }
  return groups;
}

// Places `personId` at 1-based position `position` within `group` (clamped) and
// returns the resulting 1..n order for every member, fixing duplicates/gaps.
export function renumberGroup<T extends SiblingFields>(
  group: T[],
  personId: string,
  position: number
): Map<string, number> {
  const person = group.find((p) => p._id === personId);
  const others = group.filter((p) => p._id !== personId).sort(compareBirthOrder);
  if (person) {
    const index = Math.min(Math.max(Math.round(position) - 1, 0), others.length);
    others.splice(index, 0, person);
  }
  return new Map(others.map((p, i) => [p._id, i + 1]));
}
