'use client'

import { useEffect, useState } from 'react'

export default function ShareButtons({ title }: { title: string }) {
  const [url, setUrl] = useState('')
  const [copied, setCopied] = useState(false)
  useEffect(() => setUrl(window.location.href), [])
  if (!url) return null

  const u = encodeURIComponent(url)
  const t = encodeURIComponent(title)
  const links = [
    ['Facebook', `https://www.facebook.com/sharer/sharer.php?u=${u}`],
    ['X', `https://twitter.com/intent/tweet?url=${u}&text=${t}`],
    ['WhatsApp', `https://wa.me/?text=${t}%20${u}`],
    ['Telegram', `https://t.me/share/url?url=${u}&text=${t}`],
  ]
  return (
    <div className="share">
      <span className="share__label">Share</span>
      {links.map(([name, href]) => (
        <a key={name} href={href} target="_blank" rel="noopener noreferrer">
          {name}
        </a>
      ))}
      <button
        type="button"
        onClick={() => navigator.clipboard.writeText(url).then(() => setCopied(true), () => {})}
      >
        {copied ? 'Copied' : 'Copy link'}
      </button>
    </div>
  )
}
