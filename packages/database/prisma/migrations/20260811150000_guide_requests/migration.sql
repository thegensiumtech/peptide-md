-- Lead magnet downloads. Deliberately not the Patient table: someone who
-- downloads a guide has not booked anything, and marketing contacts do not
-- belong in a clinical record.
CREATE TABLE "guide_requests" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "guideSlug" TEXT NOT NULL DEFAULT 'peptide-guide',
    "source" TEXT NOT NULL DEFAULT 'website',
    "downloadToken" TEXT NOT NULL,
    "downloadCount" INTEGER NOT NULL DEFAULT 0,
    "lastDownloadAt" TIMESTAMP(3),
    "marketingConsent" BOOLEAN NOT NULL DEFAULT false,
    "consentWording" TEXT NOT NULL,
    "emailSentAt" TIMESTAMP(3),
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "guide_requests_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "guide_requests_downloadToken_key" ON "guide_requests"("downloadToken");
CREATE INDEX "guide_requests_email_idx" ON "guide_requests"("email");
CREATE INDEX "guide_requests_createdAt_idx" ON "guide_requests"("createdAt");
