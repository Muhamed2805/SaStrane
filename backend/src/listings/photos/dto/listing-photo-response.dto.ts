// A photo of a job. Both files are WebP.
export class ListingPhotoDto {
  id!: string;

  /** At most 1600 pixels on the longest side. */
  url!: string;

  /** At most 640 pixels on the longest side, for lists. */
  thumbnailUrl!: string;

  /** The size of the image at `url`, in pixels. */
  width!: number;

  height!: number;
}
