import Image from 'next/image';
import { cn } from '@/utils/cn';

export function CampaignBanner({
  src,
  className,
  sizes = '(max-width: 1024px) 100vw, 272px',
}: {
  src: string;
  className?: string;
  sizes?: string;
}) {
  if (!src) return null;
  return (
    <div className={cn('relative overflow-hidden rounded-md', className)}>
      <Image src={src} alt="" fill className="object-cover" sizes={sizes} />
    </div>
  );
}
