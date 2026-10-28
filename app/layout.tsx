import type { Metadata } from 'next'
import { Noto_Sans_Malayalam, Noto_Serif_Malayalam } from 'next/font/google'
import { getCategories } from '@/lib/content'
import { SITE_URL } from '@/lib/site'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import SiteChrome from '@/components/SiteChrome'
import './globals.css'

const sans = Noto_Sans_Malayalam({ subsets: ['malayalam', 'latin'], variable: '--font-sans', display: 'swap' })
const serif = Noto_Serif_Malayalam({ subsets: ['malayalam', 'latin'], variable: '--font-serif', display: 'swap' })

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: 'Mohammed Nabi', template: '%s - Mohammed Nabi' },
  description: 'Mohammed Nabi',
  openGraph: { siteName: 'Mohammed Nabi', locale: 'ml_IN', type: 'website' },
}

// runs before paint: apply saved (or system) colour scheme and reading size, so nothing flashes
const init = `try{var d=document.documentElement,t=localStorage.getItem('theme')||(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');d.dataset.theme=t;var r=localStorage.getItem('read');if(r)d.style.setProperty('--read',r+'rem')}catch(e){}`

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const cats = await getCategories()
  return (
    <html lang="ml" className={`${sans.variable} ${serif.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: init }} />
      </head>
      <body>
        <a className="skip-link" href="#main">Skip to content</a>
        <SiteChrome header={<Header cats={cats} />} footer={<Footer cats={cats} />}>
          {children}
        </SiteChrome>
      </body>
    </html>
  )
}
