import { supabase } from '@/lib/supabase'
import { notFound } from 'next/navigation'
import ProjectForm from '@/components/forms/ProjectForm'

export default async function EditProjectPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug: rawSlug } = await params
  const decodedSlug = decodeURIComponent(rawSlug)

  const res = await supabase`SELECT * FROM proyectos WHERE slug = ${decodedSlug} LIMIT 1`
  const project = res[0]
  if (!project) return notFound()

  let materialSuggestions: string[] = []
  try {
    const rows = await supabase`SELECT material_name FROM materiales WHERE material_name IS NOT NULL ORDER BY material_name`
    materialSuggestions = rows.map((r: any) => r.material_name).filter(Boolean)
  } catch (err) {
    console.error('No se pudieron cargar materiales:', err)
  }

  return <ProjectForm initialData={project} materialSuggestions={materialSuggestions} />
}
