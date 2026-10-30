import Link from 'next/link'
import { type Cat, decode } from '@/lib/format'

export default function Footer({ cats }: { cats: Cat[] }) {
  return (
    <footer className="site-footer">
      <div className="wrap footer__grid">
        <div>
          <img className="footer__logo" src="/uploads/2018/10/logo-nabi1.png" alt="Mohammed Nabi" />
          <p className="footer__about">
            പ്രവാചകൻ മുഹമ്മദ് നബി (സ)യുടെ ജീവിതം, സന്ദേശം, ലേഖനങ്ങൾ, ഹദീസുകൾ.
          </p>
        </div>
        <div>
          <h2 className="footer__title">വിഭാഗങ്ങൾ</h2>
          <ul className="chips">
            {cats.map((c) => (
              <li key={c.id}>
                <Link href={`/category/${c.slug}`}>{decode(c.name)}</Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h2 className="footer__title">ലിങ്കുകൾ</h2>
          <ul className="footer__links">
            <li><Link href="/">ഹോം</Link></li>
            <li><Link href="/search">തിരയുക</Link></li>
            <li><a href="https://islamonlive.in/">IslamOnlive</a></li>
            <li>
              <Link href="/admin" className="footer__admin">Admin</Link>
            </li>
          </ul>
        </div>
      </div>
      <div className="wrap footer__legal">© {new Date().getFullYear()} Mohammed Nabi · IslamOnlive</div>
    </footer>
  )
}
