export const TOUR_BOOKING_STATUSES = ["Pending", "Confirmed", "Declined"] as const;

export type TourBookingStatus = (typeof TOUR_BOOKING_STATUSES)[number];
