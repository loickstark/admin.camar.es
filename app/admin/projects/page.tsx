import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import ProjectsList, { type ProjectItem } from '@/components/admin/ProjectsList'
import FlashNotice from '@/components/admin/FlashNotice'
import { deleteProjectAction } from './actions'

export default async function ProjectsListPage() {
  let proyectos: any[] = []
  try {
    proyectos = await supabase`SELECT id, slug, title, project_location, filter, bg_image, main_image FROM proyectos ORDER BY created_at DESC`
  } catch (err) {
    console.error('Error en Neon Proyectos:', err)
    proyectos = []
  }

  const items: ProjectItem[] = proyectos.map((p: any) => {
    const titulo = p.title?.es || 'Sin título'
    const ubicacion = p.project_location?.es || 'Ubicación no definida'
    const portada = p.bg_image || p.main_image || '/placeholder-project.jpg'
    const filtro = p.filter || ''

    const searchText = [titulo, ubicacion, filtro]
      .join(' ')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()

    return {
      id: p.id,
      titulo,
      ubicacion,
      portada,
      filtro,
      editHref: `/admin/projects/${p.slug || p.id}`,
      searchText,
    }
  })

  return (
    <div className="space-y-8">
      <FlashNotice
        messages={{
          'project-created': 'Proyecto creado con éxito',
          'project-updated': 'Proyecto actualizado con éxito',
        }}
      />

      {/* HEADER */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-vollkorn text-4xl uppercase tracking-tight text-dynamicBlack">Proyectos</h1>
          <p className="mt-2 text-dynamicBlack/60">Gestiona el portafolio de obras</p>
        </div>
        <Link href="/admin/projects/new" className="btn-primary">
          + Nuevo proyecto
        </Link>
      </div>

      <ProjectsList items={items} deleteAction={deleteProjectAction} />
    </div>
  )
}
