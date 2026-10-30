import type { PersonData } from "@/types/models";

// A person's siblings share this exact same set of parents; people with no
// recorded parents have no sibling group (can't be birth-order-reordered).
export function siblingKeyOf(person: Pick<PersonData, "parents">): string | null {
  return person.parents.length > 0 ? [...person.parents].sort().join("|") : null;
}

// Groups people by siblingKeyOf, each group sorted by birth order (`order`, ascending).
export function computeSiblingGroups(people: PersonData[]): Map<string, PersonData[]> {
  const groups = new Map<string, PersonData[]>();
  for (const person of people) {
    const key = siblingKeyOf(person);
    if (!key) continue;
    const group = groups.get(key) ?? [];
    group.push(person);
    groups.set(key, group);
  }
  for (const group of groups.values()) {
    group.sort((a, b) => a.order - b.order);
  }
  return groups;
}
