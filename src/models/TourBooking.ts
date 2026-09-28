import mongoose, { Schema, type Document, type Model } from "mongoose";

export type TourBookingStatus = "Pending" | "Confirmed" | "Declined";

export interface ITourBooking extends Document {
  name: string;
  email: string;
  phone: string;
  numberOfVisitors: number;
  notes: string;
  requestedDateTime: Date;
  confirmedDateTime: Date | null;
  status: TourBookingStatus;
  createdAt: Date;
  updatedAt: Date;
}

const tourBookingSchema = new Schema<ITourBooking>(
  {
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
    numberOfVisitors: {
      type: Number,
      required: true,
      min: 1,
      max: 50,
    },
    notes: {
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
      enum: ["Pending", "Confirmed", "Declined"],
      default: "Pending",
    },
  },
  { timestamps: true },
);

export const TourBooking: Model<ITourBooking> =
  mongoose.models.TourBooking ?? mongoose.model<ITourBooking>("TourBooking", tourBookingSchema);
