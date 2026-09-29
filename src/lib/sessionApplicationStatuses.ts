export const SESSION_APPLICATION_STATUSES = ["Pending", "Verified", "Rejected"] as const;

export type SessionApplicationStatus = (typeof SESSION_APPLICATION_STATUSES)[number];
