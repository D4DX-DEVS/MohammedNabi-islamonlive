'use client'

import { useEffect, useRef, useState, type MouseEvent } from 'react'
import { Icon, useToast, type IconName } from './ui'

// A small visual editor on top of contentEditable. It is uncontrolled on purpose: React never rewrites the text while
// someone types, which would move the cursor. The parent hears about changes through onChange.

// what the browser generates is tidied up: <div> -> <p>, <b>/<i> -> <strong>/<em>, no inline styles
const clean = (h: string) =>
  h
    .replace(/<div(\s[^>]*)?>/gi, '<p>').replace(/<\/div>/gi, '</p>')
    .replace(/<b(\s[^>]*)?>/gi, '<strong>').replace(/<\/b>/gi, '</strong>')
    .replace(/<i(\s[^>]*)?>/gi, '<em>').replace(/<\/i>/gi, '</em>')
    .replace(/\s(style|contenteditable|dir)="[^"]*"/gi, '')
    .replace(/<p>(<br\s*\/?>|\s|&nbsp;)*<\/p>/gi, '')

// HTML is loaded through an inert <template>, and anything that could run code is dropped first
function safe(html: string) {
  const t = document.createElement('template')
  t.innerHTML = html
  t.content.querySelectorAll('script,iframe,object,embed,style,link,meta,form').forEach((n) => n.remove())
  t.content.querySelectorAll('*').forEach((el) => {
    for (const a of Array.from(el.attributes)) {
      if (/^on/i.test(a.name) || (/^(href|src)$/i.test(a.name) && /^\s*javascript:/i.test(a.value))) el.removeAttribute(a.name)
    }
  })
  return t.innerHTML
}

const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

type Tool = { icon: IconName; label: string; run: () => void; active?: boolean }

export default function RichEditor({ initial, onChange, onPhoto }: { initial: string; onChange: (html: string) => void; onPhoto: (file: File) => Promise<string> }) {
  const toast = useToast()
  const area = useRef<HTMLDivElement>(null)
  const latest = useRef(initial) // newest HTML, kept so switching views loses nothing
  const saved = useRef<Range | null>(null) // cursor position while a file dialog is open
  const fileInput = useRef<HTMLInputElement>(null)
  const [mode, setMode] = useState<'visual' | 'code'>('visual')
  const [code, setCode] = useState(initial)
  const [busy, setBusy] = useState(false)

  const markEmpty = () => {
    const el = area.current
    if (el) el.dataset.empty = el.textContent?.trim() || el.querySelector('img') ? 'false' : 'true'
  }
  const emit = (html: string) => {
    latest.current = html
    onChange(html)
  }
  const sync = () => {
    if (!area.current) return
    emit(clean(area.current.innerHTML))
    markEmpty()
  }

  // put the HTML into the editable area on mount and whenever we come back from the code view
  useEffect(() => {
    if (mode !== 'visual' || !area.current) return
    area.current.innerHTML = safe(latest.current)
    markEmpty()
    document.execCommand('defaultParagraphSeparator', false, 'p')
    document.execCommand('styleWithCSS', false, 'false')
  }, [mode])

  const run = (command: string, arg?: string) => {
    area.current?.focus()
    document.execCommand(command, false, arg)
    sync()
  }
  const toggleBlock = (tag: 'h2' | 'blockquote') => {
    area.current?.focus()
    const current = document.queryCommandValue('formatBlock').toLowerCase()
    document.execCommand('formatBlock', false, current === tag ? 'p' : tag)
    sync()
  }
  const addLink = () => {
    const url = window.prompt('Link address (starts with https://)')?.trim()
    if (!url) return
    if (!/^(https?:\/\/|\/)/i.test(url)) return toast.err('A link must start with https:// or /')
    run('createLink', url)
  }

  const rememberCursor = () => {
    const sel = window.getSelection()
    saved.current = sel && sel.rangeCount && area.current?.contains(sel.anchorNode) ? sel.getRangeAt(0).cloneRange() : null
  }
  const insertPhoto = async (file?: File) => {
    if (!file) return
    setBusy(true)
    try {
      const path = await onPhoto(file)
      area.current?.focus()
      const sel = window.getSelection()
      if (saved.current && sel) {
        sel.removeAllRanges()
        sel.addRange(saved.current)
      }
      document.execCommand('insertHTML', false, `<img src="${path}" alt="">`)
      sync()
    } catch (e) {
      toast.err(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      setBusy(false)
      if (fileInput.current) fileInput.current.value = ''
    }
  }

  const noFocusLoss = (e: MouseEvent) => e.preventDefault() // keeps the text selection when a toolbar button is pressed
  const tools: (Tool | 'gap')[] = [
    { icon: 'bold', label: 'Bold', run: () => run('bold') },
    { icon: 'italic', label: 'Italic', run: () => run('italic') },
    'gap',
    { icon: 'heading', label: 'Heading', run: () => toggleBlock('h2') },
    { icon: 'quote', label: 'Quote', run: () => toggleBlock('blockquote') },
    { icon: 'list', label: 'Bullet list', run: () => run('insertUnorderedList') },
    { icon: 'listOrdered', label: 'Numbered list', run: () => run('insertOrderedList') },
    'gap',
    { icon: 'link', label: 'Add link', run: addLink },
    { icon: 'image', label: 'Insert photo', run: () => { rememberCursor(); fileInput.current?.click() } },
    'gap',
    { icon: 'undo', label: 'Undo', run: () => run('undo') },
    { icon: 'redo', label: 'Redo', run: () => run('redo') },
  ]

  return (
    <div className="rte">
      <div className="rte__bar">
        {mode === 'visual' ? (
          <div className="rte__tools" role="toolbar" aria-label="Formatting">
            {tools.map((t, i) =>
              t === 'gap' ? (
                <span key={i} className="rte__gap" />
              ) : (
                <button key={t.label} type="button" className="rte__btn" title={t.label} aria-label={t.label} onMouseDown={noFocusLoss} onClick={t.run} disabled={busy && t.icon === 'image'}>
                  <Icon name={t.icon} />
                </button>
              ),
            )}
            {busy && <span className="rte__busy">Uploading…</span>}
          </div>
        ) : (
          <span className="rte__hint">HTML code. Switch back to see the formatted text.</span>
        )}
        <button
          type="button"
          className={`rte__mode ${mode === 'code' ? 'is-on' : ''}`}
          onClick={() => {
            if (mode === 'visual') {
              setCode(latest.current)
              setMode('code')
            } else {
              emit(code)
              setMode('visual')
            }
          }}
        >
          <Icon name="code" size={16} /> {mode === 'visual' ? 'HTML' : 'Back to editor'}
        </button>
      </div>

      {mode === 'visual' ? (
        <div
          ref={area}
          className="rte__area prose"
          contentEditable
          suppressContentEditableWarning
          role="textbox"
          aria-multiline="true"
          aria-label="Post text"
          data-placeholder="Write the post here…"
          data-empty="true"
          onInput={sync}
          onBlur={sync}
          onPaste={(e) => {
            // paste as plain text: formatting copied from Word or web pages brings a lot of junk with it
            e.preventDefault()
            const text = e.clipboardData.getData('text/plain')
            const html = text
              .split(/\n{2,}/)
              .filter((p) => p.trim())
              .map((p) => `<p>${escapeHtml(p.trim()).replace(/\n/g, '<br>')}</p>`)
              .join('')
            document.execCommand('insertHTML', false, html)
          }}
        />
      ) : (
        <textarea className="rte__code" value={code} onChange={(e) => { setCode(e.target.value); latest.current = e.target.value; onChange(e.target.value) }} spellCheck={false} aria-label="Post HTML" />
      )}
      <input ref={fileInput} type="file" accept="image/*" hidden onChange={(e) => insertPhoto(e.target.files?.[0])} />
    </div>
  )
}
