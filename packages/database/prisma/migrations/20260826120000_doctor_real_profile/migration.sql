-- Dr Jinks's own profile.
--
-- Replaces the stand-in bio, the invented GMC number and, notably, a pull
-- quote that had been written for him and attributed to him on the public
-- page. His real registration number is here, so the page prints the
-- registration line again for the first time.
--
-- One editorial change to the text supplied: a single em dash became a comma,
-- because this project does not use them anywhere and
-- scripts/verify-no-em-dashes.mjs enforces it against the database as well as
-- the source. Nothing else was altered.
ALTER TABLE "doctors" ADD COLUMN IF NOT EXISTS "quote" TEXT;

UPDATE "doctors"
   SET "bio" = 'I''ve been practising medicine for 13 years. My training began in surgery, focused on orthopaedics, before I moved into general practice, where I''ve worked for the last six years alongside completing a Master''s in Sports and Exercise Medicine. Since then my work has spanned sports medicine, longevity and functional medicine, including training with the Institute for Functional Medicine and A4M, health screening with Bupa, NHS work in general practice and complex elderly care, and Medical Director roles for a medical wellness business and a longevity clinic in the Harley Street medical district. I''ve also worked in sport at elite level, particularly rugby and hockey, building on my own background as a high-performance athlete.

I first came across peptides several years ago through my performance and longevity work. What began as reading and research became formal training with US physicians and institutions specialising in peptide therapeutics, and I''ve continued building my knowledge and clinical experience since. I was drawn to them for the same reason I was drawn to this field in general: I want to work at the front edge of what''s possible for health and performance, and to do it properly.

Patients can expect a thorough consultation with genuine attention to detail. I take time to listen and understand the full picture: your current health, your goals and concerns, your medical history and lifestyle. From there I draw on experience across general practice, sports medicine, and performance and longevity medicine to build a detailed plan, starting with the foundations and extending to supplements and more advanced therapies where they''re right for you.

Patient safety sits at the front of everything I offer. I''m open-minded about innovative therapies, but every recommendation is individual: a careful review of your background, an honest conversation about the evidence, risks and benefits, and appropriate screening, investigations and follow-up. If I don''t think something is safe or suitable for you, I''ll say so and I won''t recommend it.',
       "gmcNumber" = '7408409',
       "specialisms" = ARRAY['Sports and performance medicine', 'Longevity and preventative health', 'General practice', 'Men''s and women''s health screening', 'Musculoskeletal medicine'],
       "languages" = ARRAY['English'],
       "quote" = 'Why be well when you can be great?'
 WHERE "name" = 'Dr Mark Jinks';
