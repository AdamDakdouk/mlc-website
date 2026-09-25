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

  await connectToDatabase();

  await Promise.all(
    parsed.data.ids.map((id, index) =>
      Teacher.updateOne({ _id: id }, { $set: { order: index } }),
    ),
  );

  return NextResponse.json({ success: true });
}
