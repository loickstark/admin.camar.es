'use client'
import { useState } from 'react'

// Detalles fijos del proyecto: labels estáticos (coinciden con el front).
// Solo se editan los valores.
const FIELDS = [
  { key: 'category', label: { es: 'Categoría', en: 'Category' }, bilingual: true },
  { key: 'date', label: { es: 'Fecha de realización', en: 'Date of completion' }, bilingual: false },
  { key: 'country', label: { es: 'País', en: 'Country' }, bilingual: true },
] as const

type Bilingual = { es: string; en: string }

const MATCHERS: Record<string, RegExp> = {
  category: /categor/i,
  date: /fecha|date/i,
  country: /pa[ií]s|countr/i,
}

const matchInitial = (initial: any[], key: string): Bilingual => {
  const re = MATCHERS[key]
  const found = (Array.isArray(initial) ? initial : []).find((d) =>
    re.test(`${d?.label?.es || ''} ${d?.label?.en || ''}`),
  )
  const v = found?.value
  if (v == null) return { es: '', en: '' }
  return typeof v === 'string' ? { es: v, en: v } : { es: v.es || '', en: v.en || '' }
}

export default function ProjectDetailsEditor({ name, initial = [] }: { name: string; initial?: any[] }) {
  const [values, setValues] = useState<Record<string, Bilingual>>(() =>
    Object.fromEntries(FIELDS.map((f) => [f.key, matchInitial(initial, f.key)])),
  )

  const update = (key: string, lang: 'es' | 'en', val: string) =>
    setValues((p) => ({ ...p, [key]: { ...p[key], [lang]: val } }))

  // Salida: array con labels fijos. La fecha se guarda como string (mismo valor).
  const output = FIELDS.map((f) => ({
    label: f.label,
    value: f.bilingual ? values[f.key] : values[f.key].es,
  }))

  return (
    <div className="space-y-4">
      {FIELDS.map((f) => (
        <div key={f.key} className="space-y-2 rounded-md border border-dynamicBlack/10 bg-baliPearl p-4">
          <p className="text-[10px] uppercase tracking-widest text-dynamicBlack/50">{f.label.es}</p>
          {f.bilingual ? (
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              <input
                className="input"
                placeholder={`${f.label.es} (ES)`}
                value={values[f.key].es}
                onChange={(e) => update(f.key, 'es', e.target.value)}
              />
              <input
                className="input"
                placeholder={`${f.label.en} (EN)`}
                value={values[f.key].en}
                onChange={(e) => update(f.key, 'en', e.target.value)}
              />
            </div>
          ) : (
            <input
              className="input"
              placeholder="Ej: 2017"
              value={values[f.key].es}
              onChange={(e) => update(f.key, 'es', e.target.value)}
            />
          )}
        </div>
      ))}
      <input type="hidden" name={name} value={JSON.stringify(output)} />
    </div>
  )
}
