import { notFound } from "next/navigation";
import Link from "next/link";
import { connectToDatabase } from "@/lib/db";
import { Family } from "@/models/Family";
import { Person } from "@/models/Person";
import { PeopleManager } from "@/components/admin/PeopleManager";
import type { PersonData } from "@/types/models";

export const dynamic = "force-dynamic";

export default async function AdminFamilyPeoplePage({
  params,
}: {
  params: Promise<{ familyId: string }>;
}) {
  const { familyId } = await params;
  await connectToDatabase();

  const family = await Family.findById(familyId).lean();
  if (!family) {
    notFound();
  }

  const peopleDocs = await Person.find({ familyId }).lean();
  const people: PersonData[] = peopleDocs.map((p) => ({
    _id: String(p._id),
    familyId: String(p.familyId),
    name: p.name,
    gender: p.gender as PersonData["gender"],
    birthDate: p.birthDate?.toISOString(),
    deathDate: p.deathDate?.toISOString(),
    photoUrl: p.photoUrl,
    bio: p.bio,
    userId: p.userId ? String(p.userId) : undefined,
    parents: (p.parents ?? []).map(String),
    spouses: (p.spouses ?? []).map(String),
  }));

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/families" className="text-sm text-slate-500 hover:underline">
          ← Back to families
        </Link>
        <h1 className="text-2xl font-semibold text-slate-900">{family.name}</h1>
        <Link href={`/tree/${familyId}`} className="text-sm text-slate-500 hover:underline">
          View public tree →
        </Link>
      </div>
      <PeopleManager familyId={familyId} initialPeople={people} />
    </div>
  );
}
