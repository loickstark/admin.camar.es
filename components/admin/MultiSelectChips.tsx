'use client'
import { useState } from 'react'

interface Option {
  value: string
  label: string
}

interface Props {
  name: string
  options: Option[]
  initial?: string[]
  placeholder?: string
}

/** Multi-selección con chips desde una lista fija. Emite hidden input name=JSON(array). */
export default function MultiSelectChips({ name, options, initial = [], placeholder = 'Añadir...' }: Props) {
  const [selected, setSelected] = useState<string[]>(() => initial.map((v) => v.toLowerCase()))

  const add = (value: string) => {
    if (value && !selected.includes(value)) setSelected([...selected, value])
  }
  const remove = (i: number) => setSelected(selected.filter((_, idx) => idx !== i))

  const labelFor = (v: string) => options.find((o) => o.value === v)?.label ?? v
  const available = options.filter((o) => !selected.includes(o.value))

  return (
    <div>
      <select
        value=""
        onChange={(e) => add(e.target.value)}
        disabled={available.length === 0}
        className="input mb-3 cursor-pointer appearance-none disabled:cursor-not-allowed disabled:opacity-50"
      >
        <option value="" disabled>
          {available.length === 0 ? 'Todo añadido' : placeholder}
        </option>
        {available.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>

      <div className="flex flex-wrap gap-2">
        {selected.length === 0 ? (
          <span className="text-[10px] uppercase italic tracking-wide text-dynamicBlack/30">Nada seleccionado</span>
        ) : (
          selected.map((v, i) => (
            <span key={i} className="flex items-center gap-2 rounded-md bg-dynamicBlack py-2 pl-4 pr-2 text-[10px] uppercase tracking-wide text-baliPearl">
              {labelFor(v)}
              <button type="button" onClick={() => remove(i)} className="cursor-pointer text-sm default-transition hover:text-bubonicBrown">×</button>
            </span>
          ))
        )}
      </div>

      <input type="hidden" name={name} value={JSON.stringify(selected)} />
    </div>
  )
}
