'use client'
import { useState } from 'react'

interface Props {
  name: string
  initial?: string[]
  /** Sugerencias (nombres del catálogo de materiales) */
  suggestions?: string[]
}

/** Combobox: filtra sugerencias mientras escribes + permite texto libre. Emite hidden input name=JSON(array). */
export default function MaterialsCombobox({ name, initial = [], suggestions = [] }: Props) {
  const [items, setItems] = useState<string[]>(initial)
  const [draft, setDraft] = useState('')
  const [open, setOpen] = useState(false)

  const add = (value: string) => {
    const v = value.trim()
    if (v && !items.includes(v)) setItems([...items, v])
    setDraft('')
    setOpen(false)
  }
  const remove = (i: number) => setItems(items.filter((_, idx) => idx !== i))

  const filtered = suggestions
    .filter((s) => !items.includes(s) && s.toLowerCase().includes(draft.toLowerCase()))
    .slice(0, 8)

  return (
    <div>
      <div className="relative">
        <div className="flex gap-2">
          <input
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value)
              setOpen(true)
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                add(draft)
              }
            }}
            placeholder="Buscar o escribir material..."
            className="input"
          />
          <button type="button" onClick={() => add(draft)} className="btn-outline btn-sm shrink-0">
            Añadir
          </button>
        </div>

        {open && filtered.length > 0 && (
          <ul className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-md border border-dynamicBlack/10 bg-white shadow-lg">
            {filtered.map((s) => (
              <li key={s}>
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault()
                    add(s)
                  }}
                  className="block w-full px-3 py-2 text-left text-sm text-dynamicBlack/80 default-transition hover:bg-secondaryGray"
                >
                  {s}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {items.length === 0 ? (
          <span className="text-[10px] uppercase italic tracking-wide text-dynamicBlack/30">Sin materiales</span>
        ) : (
          items.map((m, i) => (
            <span key={i} className="flex items-center gap-2 rounded-md bg-secondaryGray px-4 py-2 text-[10px] uppercase tracking-wide text-dynamicBlack/70">
              {m}
              <button type="button" onClick={() => remove(i)} className="cursor-pointer text-sm default-transition hover:text-red-500">×</button>
            </span>
          ))
        )}
      </div>

      <input type="hidden" name={name} value={JSON.stringify(items)} />
    </div>
  )
}
