import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="wrap notfound">
      <h1>404</h1>
      <p>ഈ പേജ് കണ്ടെത്താനായില്ല.</p>
      <p>
        <Link href="/">ഹോമിലേക്ക് മടങ്ങുക</Link> · <Link href="/search">തിരയുക</Link>
      </p>
    </div>
  )
}
