// The backend's rules for job photos, checked here first so the user hears
// about a wrong file before it is sent.
export const MAX_PHOTOS = 5;
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
export const PHOTO_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
];
// For the file picker. Phones offer the camera for image types too.
export const PHOTO_ACCEPT = PHOTO_TYPES.join(',');

// The reason a file cannot be a photo, or null when it can.
export function photoFileError(file: File): string | null {
  if (!PHOTO_TYPES.includes(file.type)) {
    return `${file.name}: slika mora biti JPG, PNG, WebP ili AVIF datoteka.`;
  }
  if (file.size > MAX_PHOTO_BYTES) {
    return `${file.name}: slika može imati najviše 5 MB.`;
  }
  return null;
}

// Splits picked files into those that can be added, within the free places,
// and the reasons the others cannot.
export function pickPhotos(files: File[], currentCount: number) {
  const accepted: File[] = [];
  const errors: string[] = [];
  let skipped = 0;

  for (const file of files) {
    const error = photoFileError(file);
    if (error) errors.push(error);
    else if (currentCount + accepted.length < MAX_PHOTOS) accepted.push(file);
    else skipped += 1;
  }
  if (skipped > 0) {
    errors.push(`Oglas može imati najviše ${MAX_PHOTOS} slika.`);
  }
  return { accepted, errors };
}

// Moves one item to the front, where the cover is.
export function moveToFront<T>(items: T[], index: number): T[] {
  if (index <= 0 || index >= items.length) return items;
  return [items[index], ...items.slice(0, index), ...items.slice(index + 1)];
}
