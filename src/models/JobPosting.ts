import mongoose, { Schema, type Document, type Model } from "mongoose";

export type JobPostingStatus = "Open" | "Closed";

export interface IJobPosting extends Document {
  title: string;
  description: string;
  requirements: string;
  status: JobPostingStatus;
  createdAt: Date;
  updatedAt: Date;
}

const jobPostingSchema = new Schema<IJobPosting>(
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
      maxlength: 5000,
    },
    requirements: {
      type: String,
      default: "",
      trim: true,
      maxlength: 5000,
    },
    status: {
      type: String,
      required: true,
      enum: ["Open", "Closed"],
      default: "Open",
    },
  },
  { timestamps: true },
);

export const JobPosting: Model<IJobPosting> =
  mongoose.models.JobPosting ?? mongoose.model<IJobPosting>("JobPosting", jobPostingSchema);
