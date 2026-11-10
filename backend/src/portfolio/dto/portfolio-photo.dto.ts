// A photo of work the user has done. Both files are WebP.
export class PortfolioPhotoDto {
  id!: string;

  /** At most 1600 pixels on the longest side. */
  url!: string;

  /** At most 640 pixels on the longest side, for the gallery grid. */
  thumbnailUrl!: string;

  /** The size of the image at `url`, in pixels. */
  width!: number;

  height!: number;

  /** What the photo shows, in the user's words. */
  caption!: string | null;
}
