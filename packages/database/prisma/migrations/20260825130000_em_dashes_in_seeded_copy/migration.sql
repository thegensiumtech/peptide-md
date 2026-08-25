-- Em dashes are not used in Peptide MD copy anywhere.
--
-- The source files were swept, but these rows were written before that and the
-- seed upserts with `update: {}`, so re-seeding never repairs an existing
-- database. They were still rendering on /the-doctor and /book.
--
-- Only our own authored, user-visible copy is rewritten here. email_logs.subject
-- also contains em dashes, and is deliberately left alone: it is a record of
-- what was actually sent, and editing it would make the log a lie.
-- webhook_events.error holds Stripe's words, not ours.

UPDATE "doctors"
   SET bio = replace(replace(bio, ' ' || chr(8212) || ' ', ', '), chr(8212), ','),
       headline = replace(replace(headline, ' ' || chr(8212) || ' ', ', '), chr(8212), ',')
 WHERE bio LIKE '%' || chr(8212) || '%' OR headline LIKE '%' || chr(8212) || '%';

UPDATE "platform_settings"
   SET "consultationSummary" = replace(
         replace("consultationSummary", ' ' || chr(8212) || ' ', ', '), chr(8212), ',')
 WHERE "consultationSummary" LIKE '%' || chr(8212) || '%';

UPDATE "availability_overrides"
   SET note = replace(replace(note, ' ' || chr(8212) || ' ', ', '), chr(8212), ',')
 WHERE note LIKE '%' || chr(8212) || '%';

-- The intake answers present today are seeded demo copy that we wrote. Future
-- rows are a patient's own words and are exempt from the check in
-- scripts/verify-no-em-dashes.mjs for that reason.
UPDATE "intake_responses"
   SET answer = replace(replace(answer, ' ' || chr(8212) || ' ', ', '), chr(8212), ',')
 WHERE answer LIKE '%' || chr(8212) || '%';
