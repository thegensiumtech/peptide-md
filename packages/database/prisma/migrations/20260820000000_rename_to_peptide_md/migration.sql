-- The brand is "Peptide MD", singular. The supplied logo settled it.
--
-- Two things are needed, and only the first is a schema change: the column
-- default for rows created from here on, and the value already sitting in the
-- single settings row on every existing database.
ALTER TABLE "platform_settings" ALTER COLUMN "emailFromName" SET DEFAULT 'Peptide MD';

UPDATE "platform_settings" SET "emailFromName" = 'Peptide MD' WHERE "emailFromName" = 'Peptides MD';
