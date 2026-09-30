import { notFound } from "next/navigation";
import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/db";
import { Announcement } from "@/models/Announcement";
import AnnouncementForm from "../../AnnouncementForm";
import BackLink from "@/components/admin/BackLink";

export const dynamic = "force-dynamic";

export default async function EditAnnouncementPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  if (!mongoose.isValidObjectId(id)) {
    notFound();
  }

  await connectToDatabase();
  const announcement = await Announcement.findById(id).lean();

  if (!announcement) {
    notFound();
  }

  return (
    <div>
      <BackLink href="/admin/dashboard/announcements" label="Back to Announcements" />
      <h1 className="mb-6 text-2xl font-semibold text-navy">Edit Announcement</h1>
      <AnnouncementForm
        mode="edit"
        announcementId={announcement._id.toString()}
        initialTitle={announcement.title}
        initialBody={announcement.body}
        initialImageUrl={announcement.imageUrl}
      />
    </div>
  );
}
