import Link from "next/link";
import { connectToDatabase } from "@/lib/db";
import { Family } from "@/models/Family";
import { Person } from "@/models/Person";
import { Card, CardContent } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  await connectToDatabase();
  const [familyCount, personCount] = await Promise.all([
    Family.countDocuments(),
    Person.countDocuments(),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-slate-900">Admin dashboard</h1>
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-slate-500">Families</p>
            <p className="text-3xl font-semibold">{familyCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-slate-500">People</p>
            <p className="text-3xl font-semibold">{personCount}</p>
          </CardContent>
        </Card>
      </div>
      <Link href="/admin/families" className="text-slate-900 underline">
        Manage families and people →
      </Link>
    </div>
  );
}
