export const MEETING_REQUEST_STATUSES = ["Pending", "Contacted"] as const;

export type MeetingRequestStatus = (typeof MEETING_REQUEST_STATUSES)[number];
