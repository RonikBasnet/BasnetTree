import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { Family } from "@/models/Family";

// Vercel Cron hits this on a schedule (see vercel.json) so the Atlas cluster
// never goes 60+ days without activity and gets auto-paused.
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectToDatabase();
  const familyCount = await Family.estimatedDocumentCount();

  return NextResponse.json({ ok: true, familyCount, timestamp: new Date().toISOString() });
}
