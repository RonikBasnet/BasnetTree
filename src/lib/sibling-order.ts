import { Person } from "@/models/Person";
import { computeSiblingGroups, renumberGroup } from "@/lib/siblings";

// Moves a person to 1-based birth-order `position` among their siblings and
// renumbers the whole sibling group to 1..n, so entering a duplicate order
// (e.g. a second "1") inserts the person there and shifts the others down.
// A missing `position` puts the person last.
export async function applyBirthOrder(familyId: string, personId: string, position?: number) {
  const docs = await Person.find({ familyId }).select("name parents order birthDate").lean();
  const people = docs.map((p) => ({
    _id: String(p._id),
    name: p.name,
    parents: (p.parents ?? []).map(String),
    order: p.order ?? 0,
    birthDate: p.birthDate?.toISOString() ?? null,
  }));

  const group = computeSiblingGroups(people).get(personId);
  if (!group) return;

  const orders = renumberGroup(group, personId, position ?? Number.MAX_SAFE_INTEGER);
  const updates = group
    .filter((p) => orders.get(p._id) !== p.order)
    .map((p) => ({
      updateOne: { filter: { _id: p._id }, update: { $set: { order: orders.get(p._id)! } } },
    }));
  if (updates.length > 0) await Person.bulkWrite(updates);
}
