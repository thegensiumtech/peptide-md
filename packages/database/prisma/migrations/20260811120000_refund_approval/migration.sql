-- Refunds become a separate, explicit decision rather than a side effect of
-- cancelling. Cancelling frees the appointment straight away; the money only
-- moves once an admin approves it.
CREATE TYPE "RefundStatus" AS ENUM ('NONE', 'PENDING', 'APPROVED', 'DECLINED', 'FAILED');

ALTER TABLE "bookings"
  ADD COLUMN "refundStatus" "RefundStatus" NOT NULL DEFAULT 'NONE',
  ADD COLUMN "refundAmount" INTEGER,
  ADD COLUMN "refundRequestedAt" TIMESTAMP(3),
  ADD COLUMN "refundRequestedBy" TEXT,
  ADD COLUMN "refundDecidedAt" TIMESTAMP(3),
  ADD COLUMN "refundDecidedBy" TEXT,
  ADD COLUMN "refundDeclineReason" TEXT;

-- Anything already refunded keeps a truthful history.
UPDATE "bookings" SET "refundStatus" = 'APPROVED' WHERE "paymentStatus" = 'REFUNDED';

CREATE INDEX "bookings_refundStatus_idx" ON "bookings"("refundStatus");
