import mongoose, { Schema, type Document, type Model, type Types } from "mongoose";
import {
  SESSION_APPLICATION_STATUSES,
  type SessionApplicationStatus,
} from "@/lib/sessionApplicationStatuses";

export type { SessionApplicationStatus };

export interface ISessionApplication extends Document {
  sessionId: Types.ObjectId;
  name: string;
  email: string;
  phone: string;
  address: string;
  paymentProofFilename: string;
  status: SessionApplicationStatus;
  submittedAt: Date;
}

const sessionApplicationSchema = new Schema<ISessionApplication>({
  sessionId: {
    type: Schema.Types.ObjectId,
    ref: "CalendarEvent",
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
  address: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200,
  },
  paymentProofFilename: {
    type: String,
    required: true,
  },
  status: {
    type: String,
    required: true,
    enum: [...SESSION_APPLICATION_STATUSES],
    default: "Pending",
  },
  submittedAt: {
    type: Date,
    default: Date.now,
  },
});

export const SessionApplication: Model<ISessionApplication> =
  mongoose.models.SessionApplication ??
  mongoose.model<ISessionApplication>("SessionApplication", sessionApplicationSchema);
