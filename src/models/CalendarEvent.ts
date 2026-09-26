import mongoose, { Schema, type Document, type Model } from "mongoose";
import { CATEGORIES, type Category } from "@/lib/calendarCategories";

export interface ICalendarEvent extends Document {
  title: string;
  category: Category;
  startDate: Date;
  endDate: Date;
  description: string;
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
  },
  { timestamps: true },
);

export const CalendarEvent: Model<ICalendarEvent> =
  mongoose.models.CalendarEvent ??
  mongoose.model<ICalendarEvent>("CalendarEvent", calendarEventSchema);
