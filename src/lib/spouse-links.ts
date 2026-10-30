import { Person } from "@/models/Person";

// Keeps spouse links two-way: whoever is added to/removed from this person's
// spouses gets this person added to/removed from theirs. Supports any number
// of marriages since it only touches the spouses that actually changed.
export async function syncSpouseLinks(personId: string, before: string[], after: string[]) {
  const added = after.filter((id) => id !== personId && !before.includes(id));
  const removed = before.filter((id) => !after.includes(id));
  if (added.length > 0) {
    await Person.updateMany({ _id: { $in: added } }, { $addToSet: { spouses: personId } });
  }
  if (removed.length > 0) {
    await Person.updateMany({ _id: { $in: removed } }, { $pull: { spouses: personId } });
  }
}
