export const SUBJECTS = [
  "Math",
  "Physics",
  "Chemistry",
  "Biology",
  "English",
  "Arabic",
  "French",
  "History",
  "Geography",
  "Computer Science",
  "Art",
  "Music",
  "Physical Education",
] as const;

export type Subject = (typeof SUBJECTS)[number];
