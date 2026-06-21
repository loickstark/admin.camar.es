'use client'

import { useEffect, useRef, useState } from 'react'
import { useNotifications } from './NotificationProvider'

/**
 * Editor visual sencillo para perfiles no técnicos.
 * El usuario ve el formato aplicado (encabezados, negrita, enlaces) y nunca
 * escribe markdown a mano, pero el valor que se guarda SÍ es markdown, para
 * mantener la compatibilidad con la web pública.
 *
 * Funciones soportadas: encabezado (h2), subencabezado (h3), negrita y enlaces.
 */

interface Props {
  value: string
  onChange: (markdown: string) => void
  placeholder?: string
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

const escapeAttr = (s: string) => escapeHtml(s).replace(/"/g, '&quot;')

// ---- markdown -> html (carga inicial) -------------------------------------
function inlineMdToHtml(text: string): string {
  let s = escapeHtml(text)
  // Enlaces [texto](url)
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, t, u) => `<a href="${escapeAttr(u)}">${t}</a>`)
  // Negrita **texto**
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  return s
}

function markdownToHtml(md: string): string {
  if (!md) return ''
  return md
    .replace(/\r\n/g, '\n')
    .split(/\n{2,}/)
    .map((raw) => {
      const block = raw.trim()
      if (!block) return ''
      if (block.startsWith('### ')) return `<h3>${inlineMdToHtml(block.slice(4).trim())}</h3>`
      if (block.startsWith('## ')) return `<h2>${inlineMdToHtml(block.slice(3).trim())}</h2>`
      // Cada párrafo es un bloque; los saltos sueltos se tratan como un espacio.
      return `<p>${inlineMdToHtml(block.replace(/\s*\n\s*/g, ' '))}</p>`
    })
    .join('')
}

// ---- html -> markdown (al editar) -----------------------------------------
function serializeInline(node: Node): string {
  let out = ''
  node.childNodes.forEach((child) => {
    if (child.nodeType === Node.TEXT_NODE) {
      out += child.textContent || ''
    } else if (child.nodeType === Node.ELEMENT_NODE) {
      const el = child as HTMLElement
      const tag = el.tagName
      if (tag === 'BR') {
        // Un salto suelto dentro de un bloque se trata como espacio: cada
        // párrafo "natural" (Enter) ya genera un bloque separado por línea en blanco.
        out += ' '
      } else if (tag === 'B' || tag === 'STRONG') {
        const inner = serializeInline(el).trim()
        out += inner ? `**${inner}**` : ''
      } else if (tag === 'A') {
        const inner = serializeInline(el) || el.textContent || ''
        out += `[${inner}](${el.getAttribute('href') || ''})`
      } else if (tag === 'SPAN') {
        // Algunos navegadores aplican negrita con estilo en lugar de <b>
        const fw = el.style?.fontWeight || ''
        const inner = serializeInline(el)
        out += fw === 'bold' || parseInt(fw, 10) >= 600 ? (inner ? `**${inner}**` : '') : inner
      } else {
        out += serializeInline(el)
      }
    }
  })
  return out
}

function htmlToMarkdown(root: HTMLElement): string {
  const blocks: string[] = []
  let buf = ''
  const flush = () => {
    const t = buf.trim()
    if (t) blocks.push(t)
    buf = ''
  }
  root.childNodes.forEach((node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      buf += node.textContent || ''
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement
      const tag = el.tagName
      if (tag === 'H2') {
        flush()
        const t = serializeInline(el).trim()
        if (t) blocks.push('## ' + t)
      } else if (tag === 'H3') {
        flush()
        const t = serializeInline(el).trim()
        if (t) blocks.push('### ' + t)
      } else if (tag === 'DIV' || tag === 'P') {
        flush()
        const t = serializeInline(el).trim()
        if (t) blocks.push(t)
      } else if (tag === 'BR') {
        flush()
      } else {
        buf += serializeInline(el)
      }
    }
  })
  flush()
  return blocks.join('\n\n')
}

export default function MarkdownEditor({ value, onChange, placeholder }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const { notify } = useNotifications()
  const [isEmpty, setIsEmpty] = useState(!value || !value.trim())
  const [active, setActive] = useState<{ bold: boolean; block: string }>({ bold: false, block: '' })

  // Editor NO controlado: cargamos el HTML inicial una sola vez para no perder
  // la posición del cursor en cada render.
  useEffect(() => {
    if (ref.current) ref.current.innerHTML = markdownToHtml(value)
    try {
      document.execCommand('defaultParagraphSeparator', false, 'p')
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const updateActive = () => {
    try {
      setActive({
        bold: document.queryCommandState('bold'),
        block: (document.queryCommandValue('formatBlock') || '').toLowerCase(),
      })
    } catch {}
  }

  const handleInput = () => {
    if (!ref.current) return
    const md = htmlToMarkdown(ref.current)
    setIsEmpty(!md.trim())
    onChange(md)
  }

  const exec = (cmd: string, val?: string) => {
    ref.current?.focus()
    try {
      // Preferimos etiquetas semánticas (<b>) en lugar de estilos en línea.
      document.execCommand('styleWithCSS', false, 'false')
    } catch {}
    document.execCommand(cmd, false, val)
    handleInput()
    updateActive()
  }

  const toggleBlock = (tag: 'h2' | 'h3') => {
    const current = (document.queryCommandValue('formatBlock') || '').toLowerCase()
    exec('formatBlock', current === tag ? 'p' : tag)
  }

  const addLink = () => {
    // Guardamos la selección actual: el banner de notificación robará el foco
    // y el cursor del editor se perdería sin esta referencia.
    const sel = window.getSelection()
    const range = sel && sel.rangeCount ? sel.getRangeAt(0).cloneRange() : null
    const collapsed = !range || range.collapsed

    notify({
      tone: 'confirm',
      message: 'Insertar enlace',
      description: collapsed
        ? 'Escribe la dirección. Se mostrará el propio enlace como texto.'
        : 'Escribe la dirección a la que apuntará el texto seleccionado.',
      input: { placeholder: 'https://ejemplo.com', type: 'url' },
      actions: [
        {
          label: 'Insertar',
          variant: 'primary',
          onClick: (val) => {
            const url = (val || '').trim()
            if (!url) return
            const href = /^https?:\/\//i.test(url) ? url : `https://${url}`
            ref.current?.focus()
            const s = window.getSelection()
            if (range && s) {
              s.removeAllRanges()
              s.addRange(range)
            }
            if (collapsed) {
              document.execCommand('insertHTML', false, `<a href="${escapeAttr(href)}">${escapeHtml(href)}</a>`)
            } else {
              document.execCommand('createLink', false, href)
            }
            handleInput()
            updateActive()
          },
        },
        { label: 'Cancelar', variant: 'ghost' },
      ],
    })
  }

  const btnCls = (isActive?: boolean) =>
    `rounded px-2.5 py-1 text-xs uppercase tracking-wide default-transition ${
      isActive ? 'bg-dynamicBlack text-baliPearl' : 'text-dynamicBlack/70 hover:bg-dynamicBlack/10'
    }`

  return (
    <div className="overflow-hidden rounded-md border border-gray-300 bg-white default-transition focus-within:border-dynamicBlack">
      {/* Barra de herramientas */}
      <div className="flex flex-wrap items-center gap-1 border-b border-dynamicBlack/10 bg-baliPearl px-2 py-1.5">
        <button type="button" title="Encabezado" onMouseDown={(e) => { e.preventDefault(); toggleBlock('h2') }} className={btnCls(active.block === 'h2')}>
          Título
        </button>
        <button type="button" title="Subencabezado" onMouseDown={(e) => { e.preventDefault(); toggleBlock('h3') }} className={btnCls(active.block === 'h3')}>
          Subtítulo
        </button>
        <span className="mx-1 h-5 w-px bg-dynamicBlack/10" />
        <button type="button" title="Negrita" onMouseDown={(e) => { e.preventDefault(); exec('bold') }} className={btnCls(active.bold)}>
          <span className="font-bold">Negrita</span>
        </button>
        <button type="button" title="Insertar enlace" onMouseDown={(e) => { e.preventDefault(); addLink() }} className={btnCls()}>
          Enlace
        </button>
      </div>

      {/* Área editable */}
      <div className="relative">
        {isEmpty && placeholder && (
          <div className="pointer-events-none absolute left-4 top-3 text-dynamicBlack/40">{placeholder}</div>
        )}
        <div
          ref={ref}
          contentEditable
          suppressContentEditableWarning
          suppressHydrationWarning
          onInput={handleInput}
          onKeyUp={updateActive}
          onMouseUp={updateActive}
          onFocus={updateActive}
          className="prose min-h-56 px-4 py-3 leading-relaxed outline-none"
        />
      </div>
    </div>
  )
}
