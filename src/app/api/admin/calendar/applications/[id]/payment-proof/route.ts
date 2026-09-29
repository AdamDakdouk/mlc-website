import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import path from "path";
import { connectToDatabase } from "@/lib/db";
import { SessionApplication } from "@/models/SessionApplication";
import { readPaymentProofFile } from "@/lib/paymentProofUpload";

const CONTENT_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!mongoose.isValidObjectId(id)) {
    return NextResponse.json({ error: "Invalid application id" }, { status: 400 });
  }

  await connectToDatabase();
  const application = await SessionApplication.findById(id).lean();
  if (!application) {
    return NextResponse.json({ error: "Application not found" }, { status: 404 });
  }

  let buffer: Buffer;
  try {
    buffer = await readPaymentProofFile(application.paymentProofFilename);
  } catch {
    return NextResponse.json({ error: "Payment proof file not found" }, { status: 404 });
  }

  const ext = path.extname(application.paymentProofFilename);
  const contentType = CONTENT_TYPES[ext] ?? "application/octet-stream";

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": contentType,
      // Unlike the Careers resume route (which forces a download for a
      // PDF), this is an image — previewing it inline in the browser is
      // more useful for an admin quickly checking a payment screenshot.
      "Content-Disposition": "inline",
    },
  });
}
