import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/db";
import { Application } from "@/models/Application";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!mongoose.isValidObjectId(id)) {
    return NextResponse.json({ error: "Invalid posting id" }, { status: 400 });
  }

  await connectToDatabase();
  const applications = await Application.find({ postingId: id })
    .sort({ submittedAt: -1 })
    .lean();

  return NextResponse.json({
    applications: applications.map((a) => ({
      id: a._id.toString(),
      name: a.name,
      email: a.email,
      phone: a.phone,
      coverNote: a.coverNote,
      submittedAt: a.submittedAt.toISOString(),
    })),
  });
}
