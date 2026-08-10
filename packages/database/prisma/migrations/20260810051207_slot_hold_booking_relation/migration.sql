-- AddForeignKey
ALTER TABLE "slot_holds" ADD CONSTRAINT "slot_holds_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
