import mongoose, { Schema, type Document, type Model, type Types } from "mongoose";

export interface IApplication extends Document {
  postingId: Types.ObjectId;
  name: string;
  email: string;
  phone: string;
  resumeFilename: string;
  coverNote: string;
  submittedAt: Date;
}

const applicationSchema = new Schema<IApplication>({
  postingId: {
    type: Schema.Types.ObjectId,
    ref: "JobPosting",
    required: true,
  },
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200,
  },
  email: {
    type: String,
    required: true,
    trim: true,
    maxlength: 254,
  },
  phone: {
    type: String,
    required: true,
    trim: true,
    maxlength: 30,
  },
  resumeFilename: {
    type: String,
    required: true,
  },
  coverNote: {
    type: String,
    default: "",
    trim: true,
    maxlength: 2000,
  },
  submittedAt: {
    type: Date,
    default: Date.now,
  },
});

export const Application: Model<IApplication> =
  mongoose.models.Application ?? mongoose.model<IApplication>("Application", applicationSchema);
