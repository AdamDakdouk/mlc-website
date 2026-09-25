import mongoose, { Schema, type Document, type Model } from "mongoose";

export interface IAnnouncement extends Document {
  title: string;
  body: string;
  imageUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const announcementSchema = new Schema<IAnnouncement>(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    body: {
      type: String,
      required: true,
      trim: true,
      maxlength: 5000,
    },
    imageUrl: {
      type: String,
      default: null,
    },
  },
  { timestamps: true },
);

export const Announcement: Model<IAnnouncement> =
  mongoose.models.Announcement ??
  mongoose.model<IAnnouncement>("Announcement", announcementSchema);
