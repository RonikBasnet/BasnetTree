import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { Person } from "@/models/Person";
import { requireAdmin } from "@/lib/require-admin";
import { personInputSchema } from "@/lib/validation";
import { applyBirthOrder } from "@/lib/sibling-order";
import { syncSpouseLinks } from "@/lib/spouse-links";

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
  const data = parsed.data.spouses
    ? { ...parsed.data, spouses: parsed.data.spouses.filter((spouseId) => spouseId !== id) }
    : parsed.data;
  const previous = await Person.findById(id).select("spouses").lean();
  const person = await Person.findByIdAndUpdate(id, data, { new: true });
  if (!previous || !person) {
    return NextResponse.json({ error: "Person not found" }, { status: 404 });
  }
  if (data.spouses) {
    await syncSpouseLinks(id, (previous.spouses ?? []).map(String), data.spouses);
  }
  // Renumber the sibling group when birth order or parents change, so a
  // duplicate order inserts this person there instead of tying with a sibling.
  if (parsed.data.order !== undefined || parsed.data.parents !== undefined) {
    await applyBirthOrder(String(person.familyId), id, parsed.data.order ?? person.order);
    return NextResponse.json(await Person.findById(id));
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
