import AnnouncementForm from "../AnnouncementForm";

export default function NewAnnouncementPage() {
  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold text-navy">New Announcement</h1>
      <AnnouncementForm mode="create" />
    </div>
  );
}
