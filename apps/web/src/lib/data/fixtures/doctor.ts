import type { Availability, DoctorProfile } from '@peptide/shared';

export const doctorProfile: DoctorProfile = {
  id: 'doc_hartley',
  name: 'Dr James Hartley',
  credentials: 'MBBS, MRCGP',
  gmcNumber: '7214883',
  photoUrl: null,
  headline: 'A doctor who will tell you when the answer is no.',
  bio: [
    'James Hartley has practised for eighteen years, the last six of them working almost entirely with patients who are using, or thinking about using, peptide therapies.',
    'He came to it the way most people do — patients arriving with a protocol they had found online, a box of vials, and nobody willing to talk to them about it. Most had been sold something. Almost none had been examined.',
    'The consultation is twenty minutes and it is deliberately plain. He will ask what you are taking, what you are trying to fix, and what your history is. Then he will tell you what he thinks, including when he thinks the honest answer is that you should not be taking anything at all.',
    'He has no products to sell and no affiliation with any supplier. That is the point of the service.',
  ].join('\n\n'),
  specialisms: [
    'Peptide therapy review',
    'Injury and post-surgical recovery',
    'Metabolic and weight management',
    'Sleep and recovery',
  ],
  languages: ['English'],
  timezone: 'Europe/London',
};

/**
 * The weekly pattern the doctor sets once, plus the one-off changes he layers
 * on top week by week. Times are doctor-local (Europe/London).
 */
export const availability: Availability = {
  timezone: 'Europe/London',
  weekly: [
    { id: 'av_mon_am', day: 'monday', startTime: '09:00', endTime: '12:00' },
    { id: 'av_mon_pm', day: 'monday', startTime: '14:00', endTime: '17:00' },
    { id: 'av_tue_am', day: 'tuesday', startTime: '09:00', endTime: '12:00' },
    // The late window is what makes the Australian side of the business work.
    { id: 'av_tue_late', day: 'tuesday', startTime: '21:00', endTime: '23:30' },
    { id: 'av_wed_am', day: 'wednesday', startTime: '09:00', endTime: '12:00' },
    { id: 'av_wed_pm', day: 'wednesday', startTime: '14:00', endTime: '17:00' },
    { id: 'av_thu_late', day: 'thursday', startTime: '21:00', endTime: '23:30' },
    { id: 'av_fri_am', day: 'friday', startTime: '09:00', endTime: '13:00' },
  ],
  overrides: [
    {
      id: 'ov_1',
      date: '2026-08-17',
      kind: 'blocked',
      startTime: null,
      endTime: null,
      note: 'Annual leave',
    },
    {
      id: 'ov_2',
      date: '2026-08-18',
      kind: 'blocked',
      startTime: null,
      endTime: null,
      note: 'Annual leave',
    },
    {
      id: 'ov_3',
      date: '2026-08-20',
      kind: 'extra',
      startTime: '18:00',
      endTime: '20:00',
      note: 'Extra evening session to clear the Australian waiting list',
    },
    {
      id: 'ov_4',
      date: '2026-08-26',
      kind: 'blocked',
      startTime: '09:00',
      endTime: '12:00',
      note: 'Clinic commitment — morning only',
    },
  ],
};
