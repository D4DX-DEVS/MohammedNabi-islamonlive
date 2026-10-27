import { type Cat, decode } from './content'

export type MenuItem = { label: string; href?: string; children?: MenuItem[] }

const flat = ['nabi-articles', 'nabi-hadith', 'speeches', 'nabi-doubts', 'pravachaka-ninda']
const groups: [string, string[]][] = [
  ['മുഹമ്മദ് നബി', ['nabi-charithram', 'kudumba-jeevitham', 'personality', 'nabi-kararukal']],
  ['മറ്റുള്ളവ', ['nabiyude-kathukal', 'nabi-vedangalil', 'stories-poems', 'nabi-books', 'nabi-synopsis']],
]

export function buildMenu(cats: Cat[]): MenuItem[] {
  const by = Object.fromEntries(cats.map((c) => [c.slug, c]))
  const item = (s: string): MenuItem[] =>
    by[s] ? [{ label: decode(by[s].name), href: `/category/${s}` }] : []
  return [
    { label: 'ഹോം', href: '/' },
    { label: groups[0][0], children: groups[0][1].flatMap(item) },
    ...flat.flatMap(item),
    { label: groups[1][0], children: groups[1][1].flatMap(item) },
  ]
}
