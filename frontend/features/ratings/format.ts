// "4,7": one decimal, with the decimal comma used in Bosnian.
export function formatAverage(average: number) {
  return average.toFixed(1).replace('.', ',');
}

// "1 ocjena", "3 ocjene", "5 ocjena", "21 ocjena", "12 ocjena".
export function ratingCountLabel(count: number) {
  const lastTwo = count % 100;
  const last = count % 10;
  if (last === 1 && lastTwo !== 11) return `${count} ocjena`;
  if (last >= 2 && last <= 4 && (lastTwo < 12 || lastTwo > 14)) {
    return `${count} ocjene`;
  }
  return `${count} ocjena`;
}

// "1 završen posao", "3 završena posla", "5 završenih poslova".
export function completedJobsLabel(count: number) {
  const lastTwo = count % 100;
  const last = count % 10;
  if (last === 1 && lastTwo !== 11) return `${count} završen posao`;
  if (last >= 2 && last <= 4 && (lastTwo < 12 || lastTwo > 14)) {
    return `${count} završena posla`;
  }
  return `${count} završenih poslova`;
}

// How fast the user usually answers, in rough steps: an exact minute count
// would promise too much.
export function responseTimeLabel(minutes: number) {
  if (minutes <= 60) return 'Obično odgovara u roku od sat vremena';
  if (minutes <= 6 * 60) return 'Obično odgovara u roku od nekoliko sati';
  if (minutes <= 24 * 60) return 'Obično odgovara u roku od jednog dana';
  return 'Obično odgovara za više od jednog dana';
}
