'use client'

import { useState } from 'react'
import Link from 'next/link'
import ImagePicker from '@/components/admin/ImagePicker'
import MaterialUsesEditor from '@/components/admin/MaterialUsesEditor'
import { SubmitButton } from '@/components/admin/SubmitButton'

interface Props {
  action: (formData: FormData) => void | Promise<void>
  materialTypes: string[]
  existingNames: string[]
}

type Errors = Record<string, string>

// Normaliza para comparar: sin acentos, minúsculas, espacios colapsados
const normalize = (s: string) =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim().replace(/\s+/g, ' ')

// Distancia de Levenshtein (nº de ediciones entre dos cadenas)
function levenshtein(a: string, b: string): number {
  const m = a.length
  const n = b.length
  if (m === 0) return n
  if (n === 0) return m
  let prev = Array.from({ length: n + 1 }, (_, i) => i)
  let curr = new Array(n + 1)
  for (let i = 1; i <= m; i++) {
    curr[0] = i
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost)
    }
    ;[prev, curr] = [curr, prev]
  }
  return prev[n]
}

// ¿Son nombres "muy parecidos"? (no idénticos)
function isSimilar(a: string, b: string): boolean {
  if (!a || !b || a === b) return false
  const dist = levenshtein(a, b)
  const maxLen = Math.max(a.length, b.length)
  if (maxLen <= 4) return dist <= 1
  if (1 - dist / maxLen >= 0.8) return true
  // Uno contiene al otro (p. ej. "Blanco" vs "Blanco Macael")
  if (a.length >= 3 && b.length >= 3 && (a.includes(b) || b.includes(a))) return true
  return false
}

export default function CreateMaterialForm({ action, materialTypes, existingNames }: Props) {
  const [errors, setErrors] = useState<Errors>({})
  const [name, setName] = useState('')

  const normName = normalize(name)
  const duplicateName =
    normName.length >= 2
      ? existingNames.find((n) => normalize(n) === normName)
      : undefined
  const similarNames =
    normName.length >= 2 && !duplicateName
      ? existingNames.filter((n) => isSimilar(normName, normalize(n))).slice(0, 4)
      : []

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    const form = e.currentTarget
    const fd = new FormData(form)
    const next: Errors = {}

    const requireText = (name: string, msg: string) => {
      const value = ((fd.get(name) as string) || '').trim()
      if (!value) next[name] = msg
    }

    requireText('material_name', 'El nombre es obligatorio.')
    if (!(fd.get('type_es') as string)) next.type_es = 'Selecciona un tipo de material.'
    requireText('location_es', 'El origen (ES) es obligatorio.')
    requireText('location_en', 'El origen (EN) es obligatorio.')
    requireText('description_es', 'La descripción (ES) es obligatoria.')
    requireText('description_en', 'La descripción (EN) es obligatoria.')

    const file = fd.get('image') as File | null
    if (!file || file.size === 0) {
      next.image = 'La imagen es obligatoria.'
    }

    let usesArr: unknown = []
    try {
      usesArr = JSON.parse((fd.get('use') as string) || '[]')
    } catch {
      usesArr = []
    }
    if (!Array.isArray(usesArr) || usesArr.length === 0) {
      next.use = 'Selecciona al menos un uso.'
    }

    // No permitir nombres duplicados (coincidencia exacta, normalizada)
    if (duplicateName) {
      next.material_name = `Ya existe un material llamado «${duplicateName}».`
    }

    if (Object.keys(next).length > 0) {
      e.preventDefault()
      setErrors(next)
    } else {
      setErrors({})
    }
  }

  const Err = ({ name }: { name: string }) =>
    errors[name] ? (
      <p className="mt-1 text-xs text-red-600" role="alert">
        {errors[name]}
      </p>
    ) : null

  const hasErrors = Object.keys(errors).length > 0

  return (
    <form action={action} onSubmit={handleSubmit} noValidate className="mx-auto max-w-6xl pb-20">

      {/* HEADER */}
      <div className="mb-10 flex items-end justify-between">
        <div>
          <Link href="/admin/materials" className="mb-4 block text-xs uppercase tracking-widest text-dynamicBlack/50 default-transition hover:text-bubonicBrown">
            Volver al catálogo
          </Link>
          <h1 className="font-vollkorn text-5xl uppercase tracking-tight text-dynamicBlack">
            Nuevo material
          </h1>
        </div>
        <SubmitButton pendingLabel="Creando…">Crear material</SubmitButton>
      </div>

      {hasErrors && (
        <div className="alert-error mb-8" role="alert" aria-live="polite">
          Revisa los campos marcados antes de guardar.
        </div>
      )}

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">

        {/* COLUMNA IZQUIERDA: IMAGEN + USOS */}
        <div className="space-y-8 lg:col-span-4">
          <section className="card space-y-6 text-center">
            <h3 className="text-xs uppercase tracking-widest text-dynamicBlack/50">Imagen del material <span className="required">*</span></h3>
            <ImagePicker />
            <Err name="image" />
          </section>

          <div>
            <MaterialUsesEditor initialUses={[]} />
            <Err name="use" />
          </div>
        </div>

        {/* COLUMNA DERECHA: DATOS */}
        <div className="space-y-8 lg:col-span-8">

          <section className="card space-y-6">
            <h3 className="font-vollkorn text-sm uppercase tracking-widest text-dynamicBlack/60">1. Identidad y clasificación</h3>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <div>
                <label className="label">Nombre <span className="required">*</span></label>
                <input
                  name="material_name"
                  type="text"
                  placeholder="Blanco Macael"
                  className="input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
                {duplicateName ? (
                  <p className="mt-1 text-xs text-red-600" role="alert">
                    Ya existe un material llamado «{duplicateName}».
                  </p>
                ) : similarNames.length > 0 ? (
                  <p className="mt-1 text-xs text-bubonicBrown" role="status">
                    Nombres muy parecidos ya existentes: {similarNames.join(', ')}.
                  </p>
                ) : (
                  <Err name="material_name" />
                )}
              </div>

              {/* DROPDOWN DE TIPOS INTEGRADO */}
              <div>
                <label className="label">Tipo de material <span className="required">*</span></label>
                <select name="type_es" defaultValue="" className="input cursor-pointer appearance-none">
                  <option value="" disabled>Selecciona un tipo...</option>
                  {materialTypes.map((type) => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
                <Err name="type_es" />
              </div>

              <div>
                <label className="label">Origen (ES) <span className="required">*</span></label>
                <input name="location_es" type="text" placeholder="Almería, España" className="input" />
                <Err name="location_es" />
              </div>
              <div>
                <label className="label">Origin (EN) <span className="required">*</span></label>
                <input name="location_en" type="text" placeholder="Almería, Spain" className="input" />
                <Err name="location_en" />
              </div>
            </div>
          </section>

          <section className="card space-y-6">
            <h3 className="font-vollkorn text-sm uppercase tracking-widest text-dynamicBlack/60">2. Descripción</h3>
            <div className="space-y-4">
              <div>
                <label className="label">Descripción (ES) <span className="required">*</span></label>
                <textarea name="description_es" rows={3} className="input leading-relaxed" />
                <Err name="description_es" />
              </div>
              <div>
                <label className="label">Description (EN) <span className="required">*</span></label>
                <textarea name="description_en" rows={3} className="input leading-relaxed" />
                <Err name="description_en" />
              </div>
            </div>
          </section>
        </div>

      </div>
    </form>
  )
}
