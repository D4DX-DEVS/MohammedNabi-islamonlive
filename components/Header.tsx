import Link from 'next/link'
import { type Cat } from '@/lib/format'
import { buildMenu } from '@/lib/menu'
import MobileNav from './MobileNav'
import ThemeToggle from './ThemeToggle'

const NABI_LOGO = '/uploads/2018/10/logo-nabi1.png'
const ISL_LOGO = '/uploads/2018/10/logo-islamonlive.png'

export const SearchIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </svg>
)

export default function Header({ cats }: { cats: Cat[] }) {
  const menu = buildMenu(cats)
  return (
    <header className="site-header">
      <div className="brandbar">
        <div className="wrap brandbar__inner">
          <Link href="/" className="brandbar__logo">
            <img src={NABI_LOGO} alt="Mohammed Nabi" />
          </Link>
          <a href="https://islamonlive.in/" className="brandbar__partner">
            <img src={ISL_LOGO} alt="islamonlive" />
          </a>
          <div className="brandbar__mobile">
            <Link href="/search" className="icon-btn" aria-label="Search">
              <SearchIcon />
            </Link>
            <ThemeToggle />
            <MobileNav menu={menu} />
          </div>
        </div>
      </div>

      <nav className="navbar" aria-label="Main">
        <div className="wrap navbar__inner">
          <ul className="navbar__list">
            {menu.map((m) => (
              <li key={m.label} className={m.children ? 'has-sub' : undefined}>
                {m.href ? <Link href={m.href}>{m.label}</Link> : <button type="button">{m.label} ▾</button>}
                {m.children && (
                  <ul className="sub">
                    {m.children.map((c) => (
                      <li key={c.href}>
                        <Link href={c.href!}>{c.label}</Link>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
          <div className="navbar__tools">
            <Link href="/search" className="icon-btn" aria-label="Search">
              <SearchIcon />
            </Link>
            <ThemeToggle />
          </div>
        </div>
      </nav>
    </header>
  )
}
