import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

// Returns a 401/403 response if the caller is not an authenticated admin, otherwise null.
export async function requireAdmin() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return null;
}
