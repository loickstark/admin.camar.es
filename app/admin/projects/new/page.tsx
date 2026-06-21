import { supabase } from '@/lib/supabase'
import ProjectForm from '@/components/forms/ProjectForm'

export default async function NewProjectPage() {
  let materialSuggestions: string[] = []
  try {
    const rows = await supabase`SELECT material_name FROM materiales WHERE material_name IS NOT NULL ORDER BY material_name`
    materialSuggestions = rows.map((r: any) => r.material_name).filter(Boolean)
  } catch (err) {
    console.error('No se pudieron cargar materiales:', err)
  }

  return <ProjectForm materialSuggestions={materialSuggestions} />
}
