import { addDays } from 'date-fns';

export interface SRSData {
  repetitions: number;
  easeFactor: number;
  interval: number;
  nextReview: string; // ISO Date string
}

export function calculateNextReview(quality: number, currentData?: Partial<SRSData>): SRSData {
  let repetitions = currentData?.repetitions || 0;
  let easeFactor = currentData?.easeFactor || 2.5;
  let interval = currentData?.interval || 0;

  if (quality >= 3) {
    if (repetitions === 0) {
      interval = 1;
    } else if (repetitions === 1) {
      interval = 6;
    } else {
      interval = Math.round(interval * easeFactor);
    }
    repetitions += 1;
    easeFactor = easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  } else {
    repetitions = 0;
    interval = 1;
  }

  if (easeFactor < 1.3) easeFactor = 1.3;

  const nextReviewDate = addDays(new Date(), interval);

  return {
    repetitions,
    easeFactor,
    interval,
    nextReview: nextReviewDate.toISOString(),
  };
}
