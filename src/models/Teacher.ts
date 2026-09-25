import mongoose, { Schema, type Document, type Model } from "mongoose";
import { SUBJECTS } from "@/lib/subjects";

export interface ITeacher extends Document {
  name: string;
  photoUrl: string | null;
  subjects: string[];
  qualifications: string;
  experience: string;
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

const teacherSchema = new Schema<ITeacher>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    photoUrl: {
      type: String,
      default: null,
    },
    subjects: {
      type: [String],
      required: true,
      validate: {
        validator: (value: string[]) =>
          value.length > 0 && value.every((s) => (SUBJECTS as readonly string[]).includes(s)),
        message: "At least one valid subject is required",
      },
    },
    qualifications: {
      type: String,
      default: "",
      trim: true,
      maxlength: 2000,
    },
    experience: {
      type: String,
      default: "",
      trim: true,
      maxlength: 2000,
    },
    order: {
      type: Number,
      required: true,
      default: 0,
    },
  },
  { timestamps: true },
);

export const Teacher: Model<ITeacher> =
  mongoose.models.Teacher ?? mongoose.model<ITeacher>("Teacher", teacherSchema);
