import { connectToDatabase } from "@/lib/db";
import { Family } from "@/models/Family";
import { FamiliesManager } from "@/components/admin/FamiliesManager";
import type { FamilyData } from "@/types/models";

export const dynamic = "force-dynamic";

export default async function AdminFamiliesPage() {
  await connectToDatabase();
  const familyDocs = await Family.find().sort({ name: 1 }).lean();
  const families: FamilyData[] = familyDocs.map((f) => ({
    _id: String(f._id),
    name: f.name,
    description: f.description,
    createdBy: String(f.createdBy),
  }));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-slate-900">Families</h1>
      <FamiliesManager initialFamilies={families} />
    </div>
  );
}
