-- The doctor's real photograph is in. His name, credentials and registration
-- number are not yet.
--
-- 7214883 was invented to fill the field. GMC numbers are seven digits, so it
-- may well belong to a real doctor who has nothing to do with this clinic, and
-- it was being printed on the public page and in the meta description Google
-- shows in results. Clearing it makes the site omit the registration line
-- entirely rather than assert one we cannot stand behind.
UPDATE "doctors"
   SET "photoUrl" = '/doctor/peptide-md-doctor.jpg',
       "gmcNumber" = ''
 WHERE "gmcNumber" = '7214883';
