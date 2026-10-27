import Image from 'next/image'

type Props = { src: string | null; alt: string; sizes: string; priority?: boolean }

// Fills its (positioned) parent. Without a photo, falls back to a tile in the category colour.
export default function Thumb({ src, alt, sizes, priority }: Props) {
  if (!src) {
    return (
      <div className="thumb thumb--fallback" aria-hidden>
        <span>ﷺ</span>
      </div>
    )
  }
  return (
    <div className="thumb">
      <Image src={src} alt={alt} fill sizes={sizes} priority={priority} />
    </div>
  )
}
