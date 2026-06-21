'use client'

import { useActionState, useState } from 'react'
import AdminLink from '@/components/admin/AdminLink'
import UnsavedChangesGuard from '@/components/admin/UnsavedChangesGuard'
import ProjectGalleryEditor from '@/components/admin/ProjectGalleryEditor'
import MultiSelectChips from '@/components/admin/MultiSelectChips'
import MaterialsCombobox from '@/components/admin/MaterialsCombobox'
import RepeaterEditor from '@/components/admin/RepeaterEditor'
import ProjectDetailsEditor from '@/components/admin/ProjectDetailsEditor'
import { DeleteProjectButton } from '@/components/admin/DeleteProjectButton'
import { upsertProjectAction, deleteProjectAction, type ProjectActionState } from '@/app/admin/projects/actions'
import { PROJECT_TYPES, PROJECT_FILTERS } from '@/lib/project-types'

interface Props {
  initialData?: any
  materialSuggestions: string[]
}

const slugify = (text: string) =>
  text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w ]+/g, '')
    .replace(/ +/g, '-')
    .replace(/^-+|-+$/g, '')

const initialState: ProjectActionState = {}

export default function ProjectForm({ initialData, materialSuggestions }: Props) {
  const isEditing = Boolean(initialData?.id)
  const [state, formAction, pending] = useActionState(upsertProjectAction, initialState)
  const [titleEs, setTitleEs] = useState(initialData?.title?.es || '')
  const [localError, setLocalError] = useState<string | null>(null)
  const [showOnProjects, setShowOnProjects] = useState(
    initialData?.id ? Boolean(initialData?.show_on_projects) : true,
  )
  const [filter, setFilter] = useState<string>(initialData?.filter || '')

  const folder = isEditing ? initialData?.folder || '' : slugify(titleEs)
  const d = initialData || {}

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    const fd = new FormData(e.currentTarget)
    const missing: string[] = []
    const reqStr = (k: string, label: string) => {
      if (!((fd.get(k) as string) || '').trim()) missing.push(label)
    }
    const reqBi = (k: string, label: string) => {
      reqStr(`${k}_es`, `${label} (ES)`)
      reqStr(`${k}_en`, `${label} (EN)`)
    }
    const reqArr = (k: string, label: string) => {
      let arr: any[] = []
      try {
        arr = JSON.parse((fd.get(k) as string) || '[]')
      } catch {
        arr = []
      }
      if (!Array.isArray(arr) || arr.length === 0) missing.push(label)
    }

    if (!titleEs.trim()) missing.push('Nombre (ES)')

    // Validación al CREAR un proyecto.
    if (!isEditing) {
      // Requeridos SIEMPRE (con o sin página de proyecto)
      reqStr('title_en', 'Nombre (EN)')
      reqBi('location', 'Ubicación')
      reqArr('type', 'Tipo')
      reqStr('bg_image', 'Portada')
      reqStr('main_image', 'Segunda imagen')

      // Requeridos SOLO si tiene página de proyecto (excepto "Más información")
      if (showOnProjects) {
        reqStr('filter', 'Filtro')
        reqArr('gallery', 'Galería')
        reqBi('about', 'Sobre el proyecto')
        reqArr('materials', 'Materiales')
        reqBi('page_title', 'Título de página')
        reqBi('page_description', 'Descripción de página')

        let details: any[] = []
        try {
          details = JSON.parse((fd.get('project_details') as string) || '[]')
        } catch {
          details = []
        }
        const cat = details[0]?.value
        const date = details[1]?.value
        const country = details[2]?.value
        if (!cat?.es?.trim() || !cat?.en?.trim()) missing.push('Detalle: Categoría')
        if (!String(date ?? '').trim()) missing.push('Detalle: Fecha de realización')
        if (!country?.es?.trim() || !country?.en?.trim()) missing.push('Detalle: País')
      }
    }

    if (missing.length > 0) {
      e.preventDefault()
      setLocalError(`Faltan campos obligatorios: ${missing.join(', ')}.`)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } else {
      setLocalError(null)
    }
  }

  const error = localError || state.error

  return (
    <form action={formAction} onSubmit={handleSubmit} noValidate className="mx-auto max-w-6xl space-y-8 pb-20">
      <UnsavedChangesGuard />
      <input type="hidden" name="id" value={d.id || ''} />
      <input type="hidden" name="folder" value={folder} />

      {/* HEADER */}
      <div className="flex items-end justify-between">
        <div>
          <AdminLink href="/admin/projects" className="mb-4 block text-xs uppercase tracking-widest text-dynamicBlack/50 default-transition hover:text-bubonicBrown">
            Volver al listado
          </AdminLink>
          <h1 className="font-vollkorn text-5xl uppercase tracking-tight text-dynamicBlack">
            {isEditing ? (d.title?.es || 'Editar proyecto') : 'Nuevo proyecto'}
          </h1>
        </div>
        <div className="flex items-center gap-3">
          {isEditing && (
            <DeleteProjectButton id={d.id} projectName={d.title?.es || 'este proyecto'} deleteAction={deleteProjectAction} />
          )}
          <button type="submit" disabled={pending} className="btn-primary">
            {pending ? 'Guardando...' : isEditing ? 'Guardar cambios' : 'Crear proyecto'}
          </button>
        </div>
      </div>

      {error && (
        <div className="alert-error" role="alert" aria-live="polite">
          {error}
        </div>
      )}

      {/* IDENTIDAD */}
      <section className="card space-y-6">
        <h3 className="font-vollkorn text-sm uppercase tracking-widest text-dynamicBlack/60">Identidad</h3>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div>
            <label className="label">Nombre (ES) <span className="required">*</span></label>
            <input name="title_es" value={titleEs} onChange={(e) => setTitleEs(e.target.value)} className="input" placeholder="Casa Privada en Londres" />
          </div>
          <div>
            <label className="label">Name (EN)</label>
            <input name="title_en" defaultValue={d.title?.en || ''} className="input" placeholder="Private Home in London" />
          </div>
          <div>
            <label className="label">Ubicación (ES)</label>
            <input name="location_es" defaultValue={d.project_location?.es || ''} className="input" placeholder="Londres, Reino Unido" />
          </div>
          <div>
            <label className="label">Location (EN)</label>
            <input name="location_en" defaultValue={d.project_location?.en || ''} className="input" placeholder="London, United Kingdom" />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div>
            <label className="label">Filtro (categoría del front)</label>
            <select
              name="filter"
              value={showOnProjects ? filter : ''}
              onChange={(e) => setFilter(e.target.value)}
              disabled={!showOnProjects}
              className="input cursor-pointer appearance-none disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="">— Sin filtro —</option>
              {PROJECT_FILTERS.map((f) => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
            {!showOnProjects && (
              <p className="mt-1 text-[10px] italic text-dynamicBlack/40">
                Solo disponible si la ficha tiene página de proyecto.
              </p>
            )}
          </div>
          <div>
            <label className="label">Tipo (uso)</label>
            <MultiSelectChips name="type" options={PROJECT_TYPES} initial={d.type || []} placeholder="Añadir tipo..." />
          </div>
        </div>

        <label className="flex cursor-pointer items-center gap-2 text-sm text-dynamicBlack">
          <input
            type="checkbox"
            name="show_on_projects"
            value="true"
            checked={showOnProjects}
            onChange={(e) => setShowOnProjects(e.target.checked)}
            className="h-4 w-4 accent-dynamicBlack"
          />
          Tiene página de proyecto (se muestra la card en el front)
        </label>
      </section>

      {/* MULTIMEDIA */}
      <ProjectGalleryEditor
        folder={folder}
        initialBg={d.bg_image || ''}
        initialMain={d.main_image || ''}
        initialGallery={Array.isArray(d.gallery) ? d.gallery : []}
      />

      {/* SOBRE EL PROYECTO */}
      <section className="card space-y-6">
        <h3 className="font-vollkorn text-sm uppercase tracking-widest text-dynamicBlack/60">Sobre el proyecto</h3>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div>
            <label className="label">Descripción (ES)</label>
            <textarea name="about_es" rows={6} defaultValue={d.about_the_project?.es || ''} className="input leading-relaxed" />
          </div>
          <div>
            <label className="label">Description (EN)</label>
            <textarea name="about_en" rows={6} defaultValue={d.about_the_project?.en || ''} className="input leading-relaxed" />
          </div>
        </div>
        <p className="text-[10px] italic text-dynamicBlack/40">Se admite HTML básico (p. ej. &lt;br&gt;).</p>
      </section>

      {/* DETALLES + MÁS INFORMACIÓN */}
      <div className="grid grid-cols-1 gap-8 xl:grid-cols-2">
        <section className="card space-y-4">
          <h3 className="font-vollkorn text-sm uppercase tracking-widest text-dynamicBlack/60">Detalles</h3>
          <ProjectDetailsEditor name="project_details" initial={d.project_details || []} />
        </section>

        <section className="card space-y-4">
          <h3 className="font-vollkorn text-sm uppercase tracking-widest text-dynamicBlack/60">Más información (máx 3)</h3>
          <RepeaterEditor
            name="more_information"
            fields={[{ key: 'title', label: 'Título' }, { key: 'content', label: 'Contenido', multiline: true }]}
            initial={d.more_information || []}
            max={3}
            addLabel="Añadir bloque"
          />
        </section>
      </div>

      {/* MATERIALES */}
      <section className="card space-y-4">
        <h3 className="font-vollkorn text-sm uppercase tracking-widest text-dynamicBlack/60">Materiales</h3>
        <MaterialsCombobox name="materials" initial={d.materials || []} suggestions={materialSuggestions} />
      </section>

      {/* METADATOS SEO */}
      <section className="card space-y-6">
        <h3 className="font-vollkorn text-sm uppercase tracking-widest text-dynamicBlack/60">Metadatos (SEO)</h3>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div>
            <label className="label">Título de página (ES)</label>
            <input name="page_title_es" defaultValue={d.page_title?.es || ''} className="input" />
          </div>
          <div>
            <label className="label">Page title (EN)</label>
            <input name="page_title_en" defaultValue={d.page_title?.en || ''} className="input" />
          </div>
          <div>
            <label className="label">Descripción de página (ES)</label>
            <textarea name="page_description_es" rows={3} defaultValue={d.page_description?.es || ''} className="input leading-relaxed" />
          </div>
          <div>
            <label className="label">Page description (EN)</label>
            <textarea name="page_description_en" rows={3} defaultValue={d.page_description?.en || ''} className="input leading-relaxed" />
          </div>
        </div>
      </section>
    </form>
  )
}
