-- Dr Jinks's change list of 5 October 2026.
--
-- The fee and the length of the consultation live here and nowhere else. The
-- site, the booking flow, Stripe checkout, the slot grid and the partner API
-- all read these two columns, so changing them here changes all of them.
--
-- The slot grid follows the duration, so from this point the diary is cut into
-- thirty-minute slots. Bookings already made on the old twenty-minute grid
-- keep their times: availability excludes anything that overlaps a confirmed
-- appointment, not just anything that starts at the same moment.
UPDATE "platform_settings"
   SET "consultationPrice" = 19500,
       "consultationDuration" = 30;

ALTER TABLE "platform_settings" ALTER COLUMN "consultationPrice" SET DEFAULT 19500;
ALTER TABLE "platform_settings" ALTER COLUMN "consultationDuration" SET DEFAULT 30;

-- First bullet of "What the consultation covers", as supplied.
UPDATE "platform_settings"
   SET "consultationInclusions" = array_replace(
         "consultationInclusions",
         'A 1:1 session with a doctor who actually understands peptide therapy, not a generic telehealth GP',
         'A 1:1 session with a doctor who works in peptide therapy every week'
       );

-- His post-nominals, now supplied by him. The qualifications row on the
-- homepage and on The doctor reappears because this is no longer empty.
UPDATE "doctors"
   SET "credentials" = 'MBChB · MRCGP · MSc Sports and Exercise Medicine'
 WHERE "gmcNumber" = '7408409';
