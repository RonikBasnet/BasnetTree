import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { Person } from "@/models/Person";
import { requireAdmin } from "@/lib/require-admin";
import { personInputSchema } from "@/lib/validation";

// Public: fetch all people in a family to render the tree (?familyId=...).
export async function GET(request: NextRequest) {
  const familyId = request.nextUrl.searchParams.get("familyId");
  if (!familyId) {
    return NextResponse.json({ error: "familyId query param is required" }, { status: 400 });
  }

  await connectToDatabase();
  const people = await Person.find({ familyId }).lean();
  return NextResponse.json(people);
}

export async function POST(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const body = await request.json();
  const parsed = personInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  await connectToDatabase();
  const person = await Person.create(parsed.data);
  return NextResponse.json(person, { status: 201 });
}
