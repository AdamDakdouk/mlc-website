import AchievementForm from "../AchievementForm";
import BackLink from "@/components/admin/BackLink";

export default function NewAchievementPage() {
  return (
    <div>
      <BackLink href="/admin/dashboard/achievements" label="Back to Achievements" />
      <h1 className="mb-6 text-2xl font-semibold text-navy">New Achievement</h1>
      <AchievementForm mode="create" />
    </div>
  );
}
