import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/db";
import { Teacher } from "@/models/Teacher";

const reorderSchema = z.object({
  ids: z.array(z.string()).min(1, "At least one id is required"),
});

export async function PUT(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const parsed = reorderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "A list of teacher ids is required" }, { status: 400 });
  }

  if (!parsed.data.ids.every((id) => mongoose.isValidObjectId(id))) {
    return NextResponse.json({ error: "One or more ids are invalid" }, { status: 400 });
  }

  const uniqueIds = new Set(parsed.data.ids);
  if (uniqueIds.size !== parsed.data.ids.length) {
    return NextResponse.json({ error: "Duplicate ids are not allowed" }, { status: 400 });
  }

  await connectToDatabase();

  const matchedCount = await Teacher.countDocuments({ _id: { $in: parsed.data.ids } });
  if (matchedCount !== parsed.data.ids.length) {
    return NextResponse.json({ error: "One or more ids do not exist" }, { status: 400 });
  }

  await Promise.all(
    parsed.data.ids.map((id, index) =>
      Teacher.updateOne({ _id: id }, { $set: { order: index } }),
    ),
  );

  return NextResponse.json({ success: true });
}
