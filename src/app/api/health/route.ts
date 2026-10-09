import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/db";

export const dynamic = "force-dynamic";

// Liveness/readiness check for the hosting platform: 200 only when the app
// can actually reach its database. Deliberately returns no details — it is
// public, so a failure message must not leak connection information.
export async function GET() {
  try {
    await connectToDatabase();
    await mongoose.connection.db?.admin().ping();
    return NextResponse.json({ status: "ok" });
  } catch {
    return NextResponse.json({ status: "error" }, { status: 503 });
  }
}
