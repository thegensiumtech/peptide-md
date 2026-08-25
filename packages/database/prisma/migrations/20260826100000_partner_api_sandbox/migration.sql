-- Sandbox bookings.
--
-- A partner building their integration has to be able to book repeatedly
-- without consuming Dr Jinks's actual appointments. The schema already
-- promised this on PartnerCredential.isSandbox ("Sandbox credentials book
-- against a test diary, never the real one") but nothing read the field.
--
-- Isolation comes from the doctor, not from a filter: sandbox credentials
-- resolve to a separate inactive doctor, so the (doctorId, startsAt) unique
-- index that stops double booking cannot even see a real appointment. The flag
-- here is what keeps those bookings out of admin lists, reporting and invoices.
ALTER TABLE "bookings" ADD COLUMN "isSandbox" BOOLEAN NOT NULL DEFAULT false;

-- Every existing booking predates the partner API and is real.
CREATE INDEX "bookings_isSandbox_idx" ON "bookings"("isSandbox");
