import mongoose, { Schema, type Document, type Model } from "mongoose";

export interface IAchievement extends Document {
  title: string;
  description: string;
  date: Date;
  photoUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const achievementSchema = new Schema<IAchievement>(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000,
    },
    date: {
      type: Date,
      required: true,
    },
    photoUrl: {
      type: String,
      default: null,
    },
  },
  { timestamps: true },
);

export const Achievement: Model<IAchievement> =
  mongoose.models.Achievement ?? mongoose.model<IAchievement>("Achievement", achievementSchema);
