import AchievementForm from "../AchievementForm";

export default function NewAchievementPage() {
  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold text-navy">New Achievement</h1>
      <AchievementForm mode="create" />
    </div>
  );
}
