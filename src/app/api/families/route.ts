import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { Family } from "@/models/Family";
import { requireAdmin } from "@/lib/require-admin";
import { familyInputSchema } from "@/lib/validation";
import { auth } from "@/lib/auth";

// Public: anyone can list families to browse available trees.
export async function GET() {
  await connectToDatabase();
  const families = await Family.find().sort({ name: 1 }).lean();
  return NextResponse.json(families);
}

export async function POST(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const session = await auth();
  const body = await request.json();
  const parsed = familyInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  await connectToDatabase();
  const family = await Family.create({
    ...parsed.data,
    createdBy: session!.user.id,
  });
  return NextResponse.json(family, { status: 201 });
}
