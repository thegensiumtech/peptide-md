-- The sandbox diary.
--
-- Sandbox credentials resolve to this doctor, which is what keeps a partner's
-- test bookings off the real calendar: the (doctorId, startsAt) index that
-- stops double booking cannot see a real appointment from here.
--
-- Created by migration rather than by the seed because it is infrastructure,
-- not sample data. The seed does not run on a live database, and without this
-- row every sandbox request would 404 there.
--
-- isActive is false so activeDoctor() can never select him, while availability
-- still resolves when asked for by id.
INSERT INTO "doctors" (
  "id", "name", "credentials", "gmcNumber", "headline", "bio",
  "specialisms", "languages", "timezone", "isActive", "createdAt", "updatedAt"
)
SELECT
  'doctor_sandbox_fixed_id',
  'Sandbox Doctor',
  'Test fixture',
  'SANDBOX',
  'Not a real doctor. Bookings made here are discarded.',
  'This record exists so partners can build and test an integration without consuming a real appointment.',
  ARRAY['Integration testing'],
  ARRAY['English'],
  'Europe/London',
  false,
  NOW(),
  NOW()
WHERE NOT EXISTS (SELECT 1 FROM "doctors" WHERE "gmcNumber" = 'SANDBOX');

-- Open every day. A partner testing at 2am should not be blocked by our
-- consulting hours.
INSERT INTO "availability_windows" ("id", "doctorId", "day", "startTime", "endTime", "createdAt", "updatedAt")
SELECT
  'sbw_' || lower(d.day::text),
  (SELECT "id" FROM "doctors" WHERE "gmcNumber" = 'SANDBOX'),
  d.day,
  '00:00',
  '23:40',
  NOW(),
  NOW()
FROM (
  SELECT unnest(ARRAY['MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY','SUNDAY']::"Weekday"[]) AS day
) d
WHERE NOT EXISTS (
  SELECT 1 FROM "availability_windows" w
  WHERE w."doctorId" = (SELECT "id" FROM "doctors" WHERE "gmcNumber" = 'SANDBOX')
);
