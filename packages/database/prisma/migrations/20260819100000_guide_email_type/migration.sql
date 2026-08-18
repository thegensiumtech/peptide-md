-- The lead-magnet guide is a transactional email like any other, so it is
-- logged the same way and can be answered for.
ALTER TYPE "EmailType" ADD VALUE IF NOT EXISTS 'GUIDE_DELIVERY';
