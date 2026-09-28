import { notFound } from "next/navigation";
import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/db";
import { TourBooking } from "@/models/TourBooking";
import BookingActions from "./BookingActions";

export const dynamic = "force-dynamic";

export default async function BookingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  if (!mongoose.isValidObjectId(id)) {
    notFound();
  }

  await connectToDatabase();
  const booking = await TourBooking.findById(id).lean();

  if (!booking) {
    notFound();
  }

  return (
    <div className="max-w-lg">
      <h1 className="mb-6 text-2xl font-semibold text-navy">Booking Request</h1>
      <dl className="space-y-3 text-sm">
        <div>
          <dt className="font-medium text-navy">Name</dt>
          <dd className="text-gray-700">{booking.name}</dd>
        </div>
        <div>
          <dt className="font-medium text-navy">Email</dt>
          <dd className="text-gray-700">{booking.email}</dd>
        </div>
        <div>
          <dt className="font-medium text-navy">Phone</dt>
          <dd className="text-gray-700">{booking.phone}</dd>
        </div>
        <div>
          <dt className="font-medium text-navy">Visitors</dt>
          <dd className="text-gray-700">{booking.numberOfVisitors}</dd>
        </div>
        <div>
          <dt className="font-medium text-navy">Requested</dt>
          <dd className="text-gray-700">
            {booking.requestedDateTime.toLocaleString(undefined, { timeZone: "UTC" })}
          </dd>
        </div>
        {booking.notes && (
          <div>
            <dt className="font-medium text-navy">Notes</dt>
            <dd className="whitespace-pre-wrap text-gray-700">{booking.notes}</dd>
          </div>
        )}
      </dl>
      <div className="mt-8 border-t border-gray-200 pt-6">
        <BookingActions
          bookingId={booking._id.toString()}
          status={booking.status}
          requestedDateTime={booking.requestedDateTime.toISOString().slice(0, 16)}
          confirmedDateTime={
            booking.confirmedDateTime ? booking.confirmedDateTime.toISOString().slice(0, 16) : null
          }
        />
      </div>
    </div>
  );
}
