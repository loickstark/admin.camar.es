'use client'
import { useState } from 'react'

interface FieldDef {
  key: string
  label: string
  /** textarea en vez de input */
  multiline?: boolean
}

type Bilingual = { es: string; en: string }
type Row = Record<string, Bilingual>

interface Props {
  name: string
  fields: FieldDef[]
  initial?: any[]
  max?: number
  addLabel?: string
}

const toBilingual = (v: any): Bilingual =>
  typeof v === 'string' ? { es: v, en: v } : { es: v?.es || '', en: v?.en || '' }

/**
 * Editor de listas de registros bilingües (label/value, title/content...).
 * Emite hidden input name=JSON(array). Cada fila: { [fieldKey]: {es,en} }.
 */
export default function RepeaterEditor({ name, fields, initial = [], max, addLabel = 'Añadir' }: Props) {
  const [rows, setRows] = useState<Row[]>(() =>
    (Array.isArray(initial) ? initial : []).map((r) => {
      const row: Row = {}
      for (const f of fields) row[f.key] = toBilingual(r?.[f.key])
      return row
    }),
  )

  const canAdd = max === undefined || rows.length < max

  const addRow = () => {
    if (!canAdd) return
    const row: Row = {}
    for (const f of fields) row[f.key] = { es: '', en: '' }
    setRows([...rows, row])
  }
  const removeRow = (i: number) => setRows(rows.filter((_, idx) => idx !== i))
  const update = (i: number, key: string, lang: 'es' | 'en', value: string) => {
    setRows(rows.map((r, idx) => (idx === i ? { ...r, [key]: { ...r[key], [lang]: value } } : r)))
  }

  return (
    <div className="space-y-4">
      {rows.map((row, i) => (
        <div key={i} className="space-y-3 rounded-md border border-dynamicBlack/10 bg-baliPearl p-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-widest text-dynamicBlack/40">#{i + 1}</span>
            <button
              type="button"
              onClick={() => removeRow(i)}
              className="cursor-pointer text-[10px] uppercase tracking-wide text-red-600 default-transition hover:text-red-700"
            >
              Quitar
            </button>
          </div>
          {fields.map((f) => (
            <div key={f.key} className="grid grid-cols-1 gap-2 md:grid-cols-2">
              {(['es', 'en'] as const).map((lang) => {
                const common = {
                  value: row[f.key][lang],
                  onChange: (e: any) => update(i, f.key, lang, e.target.value),
                  placeholder: `${f.label} (${lang.toUpperCase()})`,
                  className: 'input',
                }
                return f.multiline ? (
                  <textarea key={lang} rows={2} {...common} />
                ) : (
                  <input key={lang} type="text" {...common} />
                )
              })}
            </div>
          ))}
        </div>
      ))}

      {canAdd && (
        <button
          type="button"
          onClick={addRow}
          className="rounded-md border-2 border-dashed border-dynamicBlack/15 px-4 py-2 text-[10px] uppercase tracking-wide text-dynamicBlack/50 default-transition hover:border-dynamicBlack hover:text-dynamicBlack"
        >
          + {addLabel}
        </button>
      )}

      <input type="hidden" name={name} value={JSON.stringify(rows)} />
    </div>
  )
}
