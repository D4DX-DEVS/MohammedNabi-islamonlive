import type { Cat } from './format'

const COLORS: Record<string, string> = {
  'nabi-articles': '#8f6e00',
  'nabi-charithram': '#5d7519',
  'nabi-books': '#008271',
  'kudumba-jeevitham': '#d1204a',
  personality: '#005694',
  'nabi-hadith': '#2c6f25',
  'stories-poems': '#511d89',
}

// original section colours; other categories get a stable hue from their id
export const catColor = (c?: Pick<Cat, 'slug' | 'id'>) =>
  c ? COLORS[c.slug] ?? `hsl(${(c.id * 47) % 360} 50% 32%)` : '#2f6b2a'
