import mongoose, { Schema, type Document, type Model, type Types } from "mongoose";
import { CATEGORIES, type Category } from "@/lib/calendarCategories";

export interface ICalendarEvent extends Document {
  title: string;
  category: Category;
  startDate: Date;
  endDate: Date;
  description: string;
  teacherId?: Types.ObjectId;
  sessionDateTime?: Date;
  durationMinutes?: number;
  capacity?: number;
  price?: number;
  applicantCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const calendarEventSchema = new Schema<ICalendarEvent>(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    category: {
      type: String,
      required: true,
      enum: [...CATEGORIES],
    },
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
      required: true,
      validate: {
        validator: function (this: ICalendarEvent, value: Date) {
          return value >= this.startDate;
        },
        message: "End date must be on or after start date",
      },
    },
    description: {
      type: String,
      default: "",
      trim: true,
      maxlength: 1000,
    },
    teacherId: {
      type: Schema.Types.ObjectId,
      ref: "Teacher",
      required: false,
    },
    sessionDateTime: {
      type: Date,
      required: false,
    },
    durationMinutes: {
      type: Number,
      required: false,
      min: 1,
      max: 480,
    },
    capacity: {
      type: Number,
      required: false,
      min: 1,
      max: 500,
    },
    price: {
      type: Number,
      required: false,
      min: 0,
      max: 100000,
    },
    applicantCount: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
  },
  { timestamps: true },
);

export const CalendarEvent: Model<ICalendarEvent> =
  mongoose.models.CalendarEvent ??
  mongoose.model<ICalendarEvent>("CalendarEvent", calendarEventSchema);
