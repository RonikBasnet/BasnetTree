import Link from "next/link";
import { connectToDatabase } from "@/lib/db";
import { Family } from "@/models/Family";
import { Card, CardContent } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  await connectToDatabase();
  const families = await Family.find().sort({ name: 1 }).lean();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Family Trees</h1>
        <p className="text-slate-500">Browse any family tree below. No login required to view.</p>
      </div>

      {families.length === 0 ? (
        <p className="text-slate-500">
          No family trees have been created yet. An admin can add one from the admin dashboard.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {families.map((family) => (
            <Link key={String(family._id)} href={`/tree/${family._id}`}>
              <Card className="transition-shadow hover:shadow-md">
                <CardContent className="p-4">
                  <p className="font-medium text-slate-900">{family.name}</p>
                  {family.description && (
                    <p className="text-sm text-slate-500">{family.description}</p>
                  )}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
