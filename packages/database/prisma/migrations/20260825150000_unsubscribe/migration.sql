-- The guide form promises "unsubscribe at any time" and the stored consent
-- wording says the same, but there was no mechanism. In the UK a working
-- opt-out is required in marketing mail, and the promise was already being
-- made to people.
--
-- Recorded rather than just flipping marketingConsent back to false, so there
-- is evidence of when an opt-out was honoured.
ALTER TABLE "guide_requests" ADD COLUMN "unsubscribedAt" TIMESTAMP(3);
