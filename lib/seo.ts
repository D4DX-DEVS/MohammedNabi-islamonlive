import type { Metadata } from 'next'

export const SITE_NAME = 'Mohammed Nabi'
export const SITE_DESC =
  'മുഹമ്മദ് നബി (സ)യുടെ ജീവിതം, സന്ദേശം, ഹദീസ്, ചരിത്രം, കുടുംബ ജീവിതം എന്നിവയെക്കുറിച്ചുള്ള മലയാള ലേഖനങ്ങളും പുസ്തകങ്ങളും.'
export const LOGO = '/uploads/2018/10/logo-nabi1.png'

// Canonical, Open Graph and Twitter tags for one page. Next replaces whole `openGraph`/`twitter` objects rather than
// merging them, so every page sets all of it here; pages without a photo share the site logo.
export function pageMeta(o: { title?: string; description: string; path: string; image?: string | null; type?: 'website' | 'article'; published?: string; author?: string }): Metadata {
  const images = [o.image ?? LOGO]
  return {
    ...(o.title ? { title: o.title } : {}),
    description: o.description,
    alternates: { canonical: o.path },
    openGraph: {
      type: o.type ?? 'website', siteName: SITE_NAME, locale: 'ml_IN', url: o.path, title: o.title ?? SITE_NAME, description: o.description, images,
      ...(o.type === 'article' ? { publishedTime: o.published, authors: o.author ? [o.author] : undefined } : {}),
    },
    twitter: { card: o.image ? 'summary_large_image' : 'summary', title: o.title ?? SITE_NAME, description: o.description, images },
  }
}

// JSON-LD must not be able to close its own <script> tag
export const jsonLd = (data: unknown) => JSON.stringify(data).replace(/</g, '\u003c')
