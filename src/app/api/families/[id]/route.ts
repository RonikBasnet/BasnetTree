import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { Family } from "@/models/Family";
import { Person } from "@/models/Person";
import { requireAdmin } from "@/lib/require-admin";
import { familyInputSchema } from "@/lib/validation";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  await connectToDatabase();
  const family = await Family.findById(id).lean();
  if (!family) {
    return NextResponse.json({ error: "Family not found" }, { status: 404 });
  }
  return NextResponse.json(family);
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { id } = await params;
  const body = await request.json();
  const parsed = familyInputSchema.partial().safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  await connectToDatabase();
  const family = await Family.findByIdAndUpdate(id, parsed.data, { new: true });
  if (!family) {
    return NextResponse.json({ error: "Family not found" }, { status: 404 });
  }
  return NextResponse.json(family);
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { id } = await params;
  await connectToDatabase();
  await Family.findByIdAndDelete(id);
  // Remove the people that belonged to this family so the tree can't orphan-reference it.
  await Person.deleteMany({ familyId: id });
  return NextResponse.json({ success: true });
}
