import mongoose, { Schema, type Document, type Model, type Types } from "mongoose";
import { MEETING_REQUEST_STATUSES, type MeetingRequestStatus } from "@/lib/meetingRequestStatuses";

export type { MeetingRequestStatus };

export interface IMeetingRequest extends Document {
  parentName: string;
  parentEmail: string;
  parentPhone: string;
  studentName: string;
  studentGrade: string;
  teacherId: Types.ObjectId;
  reason: string;
  requestedDateTime: Date;
  confirmedDateTime: Date | null;
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
    teacherId: {
      type: Schema.Types.ObjectId,
      ref: "Teacher",
      required: true,
    },
    reason: {
      type: String,
      default: "",
      trim: true,
      maxlength: 2000,
    },
    requestedDateTime: {
      type: Date,
      required: true,
    },
    confirmedDateTime: {
      type: Date,
      default: null,
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
