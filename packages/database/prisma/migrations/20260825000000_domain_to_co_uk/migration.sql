-- The registered domain is peptidemd.co.uk, not the .com that was guessed
-- before it was bought.
--
-- Two column defaults and the rows already written from them. Staff logins are
-- usernames rather than mailboxes, but leaving them on a domain that does not
-- exist is the kind of thing a client notices on the sign-in screen.
ALTER TABLE "platform_settings"
  ALTER COLUMN "emailFromAddress" SET DEFAULT 'appointments@peptidemd.co.uk';

UPDATE "platform_settings"
   SET "emailFromAddress" = replace("emailFromAddress", '@peptidemd.com', '@peptidemd.co.uk')
 WHERE "emailFromAddress" LIKE '%@peptidemd.com';

UPDATE "users"
   SET email = replace(email, '@peptidemd.com', '@peptidemd.co.uk')
 WHERE email LIKE '%@peptidemd.com';
