export const MEETING_REQUEST_STATUSES = ["Pending", "Confirmed", "Declined"] as const;

export type MeetingRequestStatus = (typeof MEETING_REQUEST_STATUSES)[number];
