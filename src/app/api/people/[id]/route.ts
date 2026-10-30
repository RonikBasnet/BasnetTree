import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { Person } from "@/models/Person";
import { requireAdmin } from "@/lib/require-admin";
import { personInputSchema } from "@/lib/validation";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  await connectToDatabase();
  const person = await Person.findById(id).lean();
  if (!person) {
    return NextResponse.json({ error: "Person not found" }, { status: 404 });
  }
  return NextResponse.json(person);
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { id } = await params;
  const body = await request.json();
  const parsed = personInputSchema.partial().safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  await connectToDatabase();
  const person = await Person.findByIdAndUpdate(id, parsed.data, { new: true });
  if (!person) {
    return NextResponse.json({ error: "Person not found" }, { status: 404 });
  }
  return NextResponse.json(person);
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { id } = await params;
  await connectToDatabase();
  await Person.findByIdAndDelete(id);
  // Detach this person from anyone who referenced them as a parent/spouse.
  await Person.updateMany({ parents: id }, { $pull: { parents: id } });
  await Person.updateMany({ spouses: id }, { $pull: { spouses: id } });
  return NextResponse.json({ success: true });
}
