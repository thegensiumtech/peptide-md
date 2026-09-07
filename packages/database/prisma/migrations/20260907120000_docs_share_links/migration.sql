-- Shareable links to the partner API documentation.
--
-- An admin generates one and emails it to the partner's development team. The
-- page it opens carries the sandbox client id and no secret, so the link is
-- safe to send to an outside party, and revoking it is a single field rather
-- than a delete, which keeps the fact that the link existed.
CREATE TABLE "docs_share_links" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "label" TEXT NOT NULL DEFAULT '',
    "createdBy" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "lastViewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "docs_share_links_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "docs_share_links_token_key" ON "docs_share_links"("token");
CREATE INDEX "docs_share_links_partnerId_idx" ON "docs_share_links"("partnerId");

ALTER TABLE "docs_share_links"
    ADD CONSTRAINT "docs_share_links_partnerId_fkey"
    FOREIGN KEY ("partnerId") REFERENCES "partners"("id") ON DELETE CASCADE ON UPDATE CASCADE;
