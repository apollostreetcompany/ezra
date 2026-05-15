export interface ReviewCard {
  id: string;
  dueAt: string;
  intervalDays: number;
  easeFactor: number;
  repetitions: number;
}

export interface ReviewRating {
  quality: 0 | 1 | 2 | 3 | 4 | 5;
  reviewedAt: string;
}

export function createReviewCard(id: string, createdAt: string): ReviewCard {
  return { id, dueAt: createdAt, intervalDays: 0, easeFactor: 2.5, repetitions: 0 };
}

export function applySm2Review(card: ReviewCard, rating: ReviewRating): ReviewCard {
  const quality = rating.quality;
  const reviewedAt = new Date(rating.reviewedAt);
  if (Number.isNaN(reviewedAt.getTime())) {
    throw new Error("reviewedAt must be an ISO date string.");
  }

  if (quality < 3) {
    return { ...card, repetitions: 0, intervalDays: 1, dueAt: addDays(reviewedAt, 1), easeFactor: nextEase(card.easeFactor, quality) };
  }

  const repetitions = card.repetitions + 1;
  const intervalDays = repetitions === 1 ? 1 : repetitions === 2 ? 6 : Math.round(card.intervalDays * card.easeFactor);
  const easeFactor = nextEase(card.easeFactor, quality);
  return { ...card, repetitions, intervalDays, easeFactor, dueAt: addDays(reviewedAt, intervalDays) };
}

function nextEase(current: number, quality: number): number {
  const next = current + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  return Math.max(1.3, Number(next.toFixed(2)));
}

function addDays(date: Date, days: number): string {
  const next = new Date(date.getTime());
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString();
}
