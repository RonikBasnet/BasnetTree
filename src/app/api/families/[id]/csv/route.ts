import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { Family } from "@/models/Family";
import { requireAdmin } from "@/lib/require-admin";
import { exportFamilyCsv, importFamilyCsv } from "@/lib/family-csv";

type RouteParams = { params: Promise<{ id: string }> };

// Admin: download everyone in the family as a CSV file.
export async function GET(_request: NextRequest, { params }: RouteParams) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { id } = await params;
  await connectToDatabase();
  const family = await Family.findById(id).lean();
  if (!family) {
    return NextResponse.json({ error: "Family not found" }, { status: 404 });
  }

  const csv = await exportFamilyCsv(id);
  const fileName = `${family.name.replace(/[^\w\- ]+/g, "").trim() || "family"}.csv`;
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${fileName}"`,
    },
  });
}

// Admin: import people from a CSV (sent as the raw request body) into the family.
export async function POST(request: NextRequest, { params }: RouteParams) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { id } = await params;
  await connectToDatabase();
  const family = await Family.findById(id).lean();
  if (!family) {
    return NextResponse.json({ error: "Family not found" }, { status: 404 });
  }

  const text = await request.text();
  try {
    const result = await importFamilyCsv(id, text);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Import failed" },
      { status: 400 }
    );
  }
}
