import { notFound } from "next/navigation";
import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/db";
import { Achievement } from "@/models/Achievement";
import AchievementForm from "../../AchievementForm";

export const dynamic = "force-dynamic";

export default async function EditAchievementPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  if (!mongoose.isValidObjectId(id)) {
    notFound();
  }

  await connectToDatabase();
  const achievement = await Achievement.findById(id).lean();

  if (!achievement) {
    notFound();
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold text-navy">Edit Achievement</h1>
      <AchievementForm
        mode="edit"
        achievementId={achievement._id.toString()}
        initialTitle={achievement.title}
        initialDescription={achievement.description}
        initialDate={achievement.date.toISOString().slice(0, 10)}
        initialPhotoUrl={achievement.photoUrl}
      />
    </div>
  );
}
