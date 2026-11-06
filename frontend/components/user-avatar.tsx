import Image from 'next/image';

type UserAvatarProps = {
  name: string;
  url: string | null | undefined;
  // Sets the size, shape and colors.
  className: string;
};

// The profile photo, or the first letter of the name without one. The name
// is always shown next to it, so the image has no alt text of its own.
export function UserAvatar({ name, url, className }: UserAvatarProps) {
  return (
    <span
      className={`relative flex shrink-0 items-center justify-center overflow-hidden ${className}`}
    >
      {url ? (
        <Image
          src={url}
          alt=""
          fill
          unoptimized
          sizes="128px"
          className="object-cover"
        />
      ) : (
        name.charAt(0).toUpperCase()
      )}
    </span>
  );
}
