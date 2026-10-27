'use client'

import { useEffect, useState } from 'react'

const SIZES = [1, 1.125, 1.25, 1.4]

export default function ReadingSize() {
  const [i, setI] = useState(1)
  // the inline script in layout already applied the saved size; mirror it in the buttons
  useEffect(() => {
    const k = SIZES.indexOf(parseFloat(document.documentElement.style.getPropertyValue('--read')))
    if (k >= 0) setI(k)
  }, [])
  const set = (n: number) => {
    const k = Math.min(SIZES.length - 1, Math.max(0, n))
    setI(k)
    document.documentElement.style.setProperty('--read', `${SIZES[k]}rem`)
    try { localStorage.setItem('read', String(SIZES[k])) } catch {}
  }
  return (
    <div className="reading-size" role="group" aria-label="Text size">
      <button type="button" onClick={() => set(i - 1)} disabled={i === 0} aria-label="Smaller text">A−</button>
      <button type="button" onClick={() => set(i + 1)} disabled={i === SIZES.length - 1} aria-label="Larger text">A+</button>
    </div>
  )
}
