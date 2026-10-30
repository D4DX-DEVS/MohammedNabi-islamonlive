# SEO audit — Mohammed Nabi (Next.js 16, App Router, ISR on Vercel, D1 data)

**Status: all fixes in the table above are implemented and verified on a local production build against the real database (status codes, unique titles/descriptions, canonicals, JSON-LD parses, redirects). Live-site verification follows the deploy.**

Audited 2026-10-29 against https://muhammad-nabi.vercel.app (live) and the code. Lab checks only; no Search Console,
Core Web Vitals field data or keyword data was available, so nothing here claims ranking or traffic effects.

## Site facts
- Public routes: `/`, `/category/{slug}[/page/N]`, `/author/{slug}[/page/N]`, `/{category}/{slug}` (329 posts, same URLs as the old WordPress site), `/search` (noindex), `/sitemap.xml`, `/robots.txt`.
- Private: `/admin`, `/api/*` (disallowed in robots; admin also `noindex`). Photos: `/uploads/*` (static), `/media/*` (R2).
- Rendering: server-rendered HTML, cached (ISR), language `ml`. Status codes verified: unknown URL 404, trailing slash 308 to no-slash.
- Content: one site language (Malayalam), so no hreflang. 296 of 329 posts have no featured photo.

## Findings (before)
| # | Sev | Finding | Status |
|---|---|---|---|
| 1 | Critical | Home and category pages had meta description "Mohammed Nabi" (author pages likewise) — identical, uninformative | Fixed |
| 2 | Critical | No canonical tag on home, category, author pages (only posts had one) | Fixed |
| 3 | High | No structured data anywhere | Fixed: WebSite+Organization (home), BlogPosting (posts), BreadcrumbList (posts, categories, authors), CollectionPage (categories), ProfilePage/Person (authors) |
| 4 | High | Open Graph on posts lacked `og:site_name`/locale (Next replaces the whole object); pages without a photo (296 posts, home, lists) had no `og:image` | Fixed: shared helper `lib/seo.ts`, site logo as fallback image |
| 5 | High | `/category/x/page/1` and `/author/x/page/1` returned 200, duplicating page 1 | Fixed: 308 to the base URL |
| 6 | Medium | Paginated pages shared the page-1 title/description | Fixed: "Page N" in title and description, self canonical |
| 7 | Medium | Post hero image had empty alt, no priority hint | Fixed: alt = post title, `fetchpriority=high` |
| 8 | Medium | No breadcrumbs | Fixed: visible trail + matching JSON-LD |
| 9 | Medium | Old WordPress search links `/?s=word` would show the home page | Fixed: 308 to `/search?q=word` |
| 10 | Low | Ambiguous "More →" link text on sections | Fixed: aria-label "More {section}" |
| 11 | Medium | Post hero image has no width/height (layout shift risk) | Open |
| 12 | Medium | Old WordPress extras not carried over: `/feed`, tag pages (only 3 tags are used by posts) | Open — needs decision |
| 13 | High | **Duplicate-domain risk:** the vercel.app address is indexable and will duplicate `mohammednabi.islamonlive.in` once DNS is switched | Open — needs approval, see below |
| 14 | Low | Sitemap has no `lastmod` for categories/authors; post `lastmod` is the publish date (no modified date is stored) | Open |
| 15 | Low | Card/hero thumbnails use `alt=""` because the card title link sits next to them (correct for decorative duplicates) | Kept |

## Already fine
robots.txt (allows all public pages, blocks `/admin`, `/api`, `/search`, references the sitemap), sitemap lists only canonical URLs (no search, admin or paginated duplicates), real 404 status for missing pages, search is `noindex`, trailing-slash redirects, one H1 per page, fonts via `next/font` (no layout-shift swap), `next/image` with WebP/AVIF for thumbnails, internal links are crawlable `<a>` tags.

## Needs your approval (not done)
1. **After DNS cutover:** set `NEXT_PUBLIC_SITE_URL=https://mohammednabi.islamonlive.in` (planned) so every canonical, sitemap URL and JSON-LD URL uses the real domain. Then either redirect `muhammad-nabi.vercel.app` to the real domain or mark it `noindex`. This is a URL migration, so I have not done it.
2. Add `/feed.xml` (RSS) to replace the WordPress feed, and/or tag pages for the 3 used tags.
3. Store a "last modified" date per post so `dateModified`/`lastmod` can be accurate.

## Content strategy (hypotheses only — no keyword data available)
- Home: the brand/topic query "മുഹമ്മദ് നബി" and variants. Needs an intro paragraph only if the owner wants one; the H1 is currently screen-reader-only text.
- Category pages ("ജീവചരിത്രം", "ഹദീസ്", "കുടുംബ ജീവിതം", "പുസ്തകം"): each could carry a short owner-written introduction. Do not auto-generate these.
- Posts: titles are series ("പ്രവാചകത്വ പരിസമാപ്തി ( 8– 8 )"); series parts compete for the same query, so link parts to each other. Validate with Search Console before changing titles.
- Thin pages: none were found among the 329 posts by this audit; word counts were not measured.

## Verify after deploying
Search Console: add the real domain, submit `/sitemap.xml`, inspect one post, one category, one author URL. Run Google's Rich Results Test on a post URL. Watch Coverage for the vercel.app duplicate.
