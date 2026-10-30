import type { PersonData } from "@/types/models";

// A person's spouses, counting links recorded on either side (older data may
// only have the link stored on one of the two people).
export function spousesOf(people: PersonData[], personId: string): string[] {
  const person = people.find((p) => p._id === personId);
  const ids = new Set(person?.spouses ?? []);
  for (const p of people) {
    if (p.spouses.includes(personId)) ids.add(p._id);
  }
  ids.delete(personId);
  return [...ids].filter((id) => people.some((p) => p._id === id));
}

// Parents to preset when adding a child to `personId`: the person plus their
// spouse when there is exactly one. With several marriages the other parent is
// ambiguous, so it's left for the user to pick.
export function assumedParents(people: PersonData[], personId: string): string[] {
  const spouses = spousesOf(people, personId);
  return spouses.length === 1 ? [personId, spouses[0]] : [personId];
}
