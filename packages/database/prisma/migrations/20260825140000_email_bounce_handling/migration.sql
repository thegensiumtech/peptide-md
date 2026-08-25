-- Bounce and complaint handling.
--
-- sentAt only ever meant "SES accepted the message". Whether it reached the
-- person is reported minutes or hours later, on a separate channel we were not
-- listening to. Without this the clinic sees a delivery that never happened,
-- and we keep mailing addresses that do not exist, which is the fastest way to
-- lose sending access.

CREATE TYPE "SuppressionReason" AS ENUM ('HARD_BOUNCE', 'COMPLAINT', 'MANUAL');

ALTER TABLE "email_logs"
  ADD COLUMN "bouncedAt" TIMESTAMP(3),
  ADD COLUMN "complainedAt" TIMESTAMP(3),
  ADD COLUMN "deliveryDetail" TEXT;

-- SES identifies a message by the id it handed back at send time.
CREATE INDEX "email_logs_providerMessageId_idx" ON "email_logs"("providerMessageId");

CREATE TABLE "email_suppressions" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "reason" "SuppressionReason" NOT NULL,
    "detail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "email_suppressions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "email_suppressions_email_key" ON "email_suppressions"("email");
