import AnnouncementForm from "../AnnouncementForm";
import BackLink from "@/components/admin/BackLink";

export default function NewAnnouncementPage() {
  return (
    <div>
      <BackLink href="/admin/dashboard/announcements" label="Back to Announcements" />
      <h1 className="mb-6 text-2xl font-semibold text-navy">New Announcement</h1>
      <AnnouncementForm mode="create" />
    </div>
  );
}
