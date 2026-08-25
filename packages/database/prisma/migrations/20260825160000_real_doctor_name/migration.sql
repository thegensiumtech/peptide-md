-- The doctor is Dr Mark Jinks. "Dr James Hartley" was filler from before the
-- clinic told us who he is, and his real photograph was already on the page,
-- so the name beside it needed to be his own.
--
-- The registration number stays empty until we are given the real one. The
-- site omits the line rather than printing a number nobody can verify.

UPDATE "doctors"
   SET name = 'Dr Mark Jinks',
       bio  = replace(bio, 'James Hartley', 'Mark Jinks')
 WHERE name = 'Dr James Hartley';

UPDATE "platform_settings"
   SET "consultationSummary" = replace("consultationSummary", 'Dr Hartley', 'Dr Jinks')
 WHERE "consultationSummary" LIKE '%Dr Hartley%';

UPDATE "users"
   SET name = 'Dr Mark Jinks', email = 'mark@peptidemd.co.uk'
 WHERE email = 'james@peptidemd.co.uk';

UPDATE "consent_records"
   SET "wording" = replace("wording", 'Dr Hartley', 'Dr Jinks')
 WHERE "wording" LIKE '%Dr Hartley%';
