import Image from 'next/image'

type Props = { src: string | null; alt: string; sizes: string; priority?: boolean }

// Fills its (positioned) parent. Without a photo, shows a quiet tile with both site logos as a watermark.
export default function Thumb({ src, alt, sizes, priority }: Props) {
  if (!src) {
    return (
      <div className="thumb thumb--fallback" aria-hidden>
        <img src="/uploads/2018/10/logo-nabi1.png" alt="" loading="lazy" decoding="async" />
        <img src="/uploads/2018/10/logo-islamonlive.png" alt="" loading="lazy" decoding="async" />
      </div>
    )
  }
  return (
    <div className="thumb">
      {/* Vercel resizes and converts to WebP/AVIF on the fly */}
      <Image src={src} alt={alt} fill sizes={sizes} priority={priority} />
    </div>
  )
}
