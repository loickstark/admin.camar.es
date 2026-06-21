'use server'

import { supabase } from '@/lib/supabase'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { randomUUID } from 'crypto'
import { recordEdit } from '@/lib/app-meta'
import { triggerDeploy } from '@/lib/deploy-hook'
import { setFlash } from '@/lib/flash'

const parseJSON = <T,>(value: FormDataEntryValue | null, fallback: T): T => {
  try {
    return value ? (JSON.parse(value as string) as T) : fallback
  } catch {
    return fallback
  }
}

const slugify = (text: string) =>
  text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w ]+/g, '')
    .replace(/ +/g, '-')
    .replace(/^-+|-+$/g, '')
    .trim()

export interface ProjectActionState {
  error?: string
}

export async function upsertProjectAction(
  _prev: ProjectActionState,
  formData: FormData,
): Promise<ProjectActionState> {
  const id = (formData.get('id') as string) || ''
  const str = (k: string) => ((formData.get(k) as string) || '').trim()
  const bilingual = (k: string) => ({ es: str(`${k}_es`), en: str(`${k}_en`) })

  const title = bilingual('title')
  const project_location = bilingual('location')
  const about_the_project = bilingual('about')
  const page_title = bilingual('page_title')
  const page_description = bilingual('page_description')
  const type = parseJSON<string[]>(formData.get('type'), []).map((t) => String(t).toLowerCase())
  const materials = parseJSON<string[]>(formData.get('materials'), []).map(String)
  const project_details = parseJSON<any[]>(formData.get('project_details'), [])
  const more_information = parseJSON<any[]>(formData.get('more_information'), []).slice(0, 3)
  const gallery = parseJSON<any[]>(formData.get('gallery'), [])
  const filter = (formData.get('filter') as string) || ''
  const bg_image = (formData.get('bg_image') as string) || ''
  const main_image = (formData.get('main_image') as string) || ''
  const submittedFolder = (formData.get('folder') as string) || ''
  const show_on_projects = formData.get('show_on_projects') === 'true'

  if (!title.es?.trim()) {
    return { error: 'El nombre del proyecto (ES) es obligatorio.' }
  }

  try {
    if (id) {
      await supabase`
        UPDATE proyectos SET
          title = ${supabase.json(title)},
          project_location = ${supabase.json(project_location)},
          about_the_project = ${supabase.json(about_the_project)},
          page_title = ${supabase.json(page_title)},
          page_description = ${supabase.json(page_description)},
          type = ${type},
          materials = ${materials},
          project_details = ${supabase.json(project_details)},
          more_information = ${supabase.json(more_information)},
          gallery = ${supabase.json(gallery)},
          filter = ${filter},
          bg_image = ${bg_image},
          main_image = ${main_image},
          folder = ${submittedFolder},
          show_on_projects = ${show_on_projects}
        WHERE id = ${id}
      `
    } else {
      // Slug único (los slugs existentes son limpios). Sufijo solo si colisiona.
      const base = slugify(title.es) || 'proyecto'
      const existing = await supabase`SELECT 1 FROM proyectos WHERE slug = ${base} LIMIT 1`
      const slug = existing.length ? `${base}-${Date.now().toString(36).slice(-4)}` : base
      const folder = submittedFolder || slug

      await supabase`
        INSERT INTO proyectos (
          id, slug, title, project_location, about_the_project, page_title, page_description,
          type, materials, project_details, more_information, gallery, filter,
          bg_image, main_image, folder, show_on_projects, created_at
        ) VALUES (
          ${randomUUID()}, ${slug}, ${supabase.json(title)}, ${supabase.json(project_location)},
          ${supabase.json(about_the_project)}, ${supabase.json(page_title)}, ${supabase.json(page_description)},
          ${type}, ${materials}, ${supabase.json(project_details)}, ${supabase.json(more_information)},
          ${supabase.json(gallery)}, ${filter}, ${bg_image}, ${main_image}, ${folder},
          ${show_on_projects}, ${new Date()}
        )
      `
    }
  } catch (error: any) {
    console.error('Error guardando proyecto:', error.message)
    return { error: 'No se pudo guardar el proyecto. Inténtalo de nuevo.' }
  }

  await recordEdit()
  await triggerDeploy()
  await setFlash(id ? 'project-updated' : 'project-created')
  revalidatePath('/admin/projects')
  revalidatePath('/')
  redirect('/admin/projects')
}

export async function deleteProjectAction(formData: FormData) {
  const id = formData.get('id')?.toString()
  if (!id) return

  try {
    await supabase`DELETE FROM proyectos WHERE id = ${id}`
  } catch (error) {
    console.error('Error eliminando proyecto:', error)
    return
  }

  await recordEdit()
  await triggerDeploy()
  revalidatePath('/admin/projects')
  redirect('/admin/projects')
}
