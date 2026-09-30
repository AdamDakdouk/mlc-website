import mongoose, { Schema, type Document, type Model } from "mongoose";
import { MEETING_REQUEST_STATUSES, type MeetingRequestStatus } from "@/lib/meetingRequestStatuses";

export type { MeetingRequestStatus };

export interface IMeetingRequest extends Document {
  parentName: string;
  parentEmail: string;
  parentPhone: string;
  parentAddress: string;
  studentName: string;
  studentGrade: string;
  reason: string;
  status: MeetingRequestStatus;
  createdAt: Date;
  updatedAt: Date;
}

const meetingRequestSchema = new Schema<IMeetingRequest>(
  {
    parentName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    parentEmail: {
      type: String,
      required: true,
      trim: true,
      maxlength: 254,
    },
    parentPhone: {
      type: String,
      required: true,
      trim: true,
      maxlength: 30,
    },
    parentAddress: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    studentName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    studentGrade: {
      type: String,
      required: true,
      trim: true,
      maxlength: 50,
    },
    reason: {
      type: String,
      default: "",
      trim: true,
      maxlength: 2000,
    },
    status: {
      type: String,
      required: true,
      enum: [...MEETING_REQUEST_STATUSES],
      default: "Pending",
    },
  },
  { timestamps: true },
);

export const MeetingRequest: Model<IMeetingRequest> =
  mongoose.models.MeetingRequest ??
  mongoose.model<IMeetingRequest>("MeetingRequest", meetingRequestSchema);
