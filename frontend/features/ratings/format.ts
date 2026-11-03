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
