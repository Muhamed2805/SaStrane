import Link from 'next/link';
import { PanelsTopLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

export function BrandLogo({
  className,
  inverted = false,
}: {
  className?: string;
  inverted?: boolean;
}) {
  return (
    <Link
      href="/"
      className={cn(
        'inline-flex items-center gap-2 text-base font-bold tracking-tight',
        inverted ? 'text-white' : 'text-primary',
        className,
      )}
      aria-label="SaStrane početna"
    >
      <span className="flex size-7 items-center justify-center rounded-md bg-primary text-white">
        <PanelsTopLeft className="size-4" strokeWidth={2.4} />
      </span>
      <span>SaStrane</span>
    </Link>
  );
}
