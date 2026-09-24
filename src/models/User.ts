import mongoose, { Schema, type Document, type Model } from "mongoose";

export interface IUser extends Document {
  email: string;
  passwordHash: string;
  role: "admin";
  createdAt: Date;
  lastLoginAt: Date | null;
}

const userSchema = new Schema<IUser>({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },
  passwordHash: {
    type: String,
    required: true,
  },
  role: {
    type: String,
    enum: ["admin"],
    default: "admin",
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  lastLoginAt: {
    type: Date,
    default: null,
  },
});

export const User: Model<IUser> =
  mongoose.models.User ?? mongoose.model<IUser>("User", userSchema);
