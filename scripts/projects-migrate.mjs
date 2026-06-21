// Migración: separa project_page en columnas y fusiona project_name en title.
// NO destructivo: añade columnas y rellena. (El DROP de columnas legacy es otro script.)
// Uso: node scripts/projects-migrate.mjs
import postgres from 'postgres'
import fs from 'fs'

const env = fs.readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
const url = env.split('\n').find((l) => l.startsWith('DATABASE_URL=')).replace('DATABASE_URL=', '').trim().replace(/^["']|["']$/g, '')
const sql = postgres(url, { ssl: 'require' })

const asObj = (v) => {
  if (!v) return {}
  if (typeof v === 'string') { try { return JSON.parse(v) } catch { return {} } }
  return v
}
const hasText = (o) => o && (String(o.es || '').trim() || String(o.en || '').trim())
const extractFolder = (url) => {
  if (!url || typeof url !== 'string') return ''
  const m = url.match(/\/Proyectos\/([^/]+)\//)
  return m ? m[1] : ''
}
const normDetails = (arr) =>
  (Array.isArray(arr) ? arr : []).map((d) => ({
    label: asObj(d?.label),
    value: typeof d?.value === 'string' ? { es: d.value, en: d.value } : asObj(d?.value),
  }))

try {
  console.log('Añadiendo columnas...')
  await sql`ALTER TABLE proyectos ADD COLUMN IF NOT EXISTS folder text DEFAULT ''`
  await sql`ALTER TABLE proyectos ADD COLUMN IF NOT EXISTS about_the_project jsonb DEFAULT '{}'::jsonb`
  await sql`ALTER TABLE proyectos ADD COLUMN IF NOT EXISTS show_on_projects boolean DEFAULT false`
  await sql`ALTER TABLE proyectos ADD COLUMN IF NOT EXISTS hide_from_gallery boolean DEFAULT false`
  await sql`ALTER TABLE proyectos ADD COLUMN IF NOT EXISTS project_details jsonb DEFAULT '[]'::jsonb`
  await sql`ALTER TABLE proyectos ADD COLUMN IF NOT EXISTS gallery jsonb DEFAULT '[]'::jsonb`
  await sql`ALTER TABLE proyectos ADD COLUMN IF NOT EXISTS more_information jsonb DEFAULT '[]'::jsonb`
  await sql`ALTER TABLE proyectos ADD COLUMN IF NOT EXISTS materials text[] DEFAULT '{}'::text[]`
  await sql`ALTER TABLE proyectos ADD COLUMN IF NOT EXISTS page_title jsonb DEFAULT '{}'::jsonb`
  await sql`ALTER TABLE proyectos ADD COLUMN IF NOT EXISTS page_description jsonb DEFAULT '{}'::jsonb`
  await sql`ALTER TABLE proyectos ADD COLUMN IF NOT EXISTS filter text DEFAULT ''`

  const rows = await sql`SELECT id, slug, title, project_name, type, bg_image, main_image, project_page FROM proyectos`
  console.log(`Backfill de ${rows.length} proyectos...`)

  let n = 0
  for (const r of rows) {
    const pp = asObj(r.project_page)

    // title = title si tiene contenido, si no project_name
    const titleObj = hasText(asObj(r.title)) ? asObj(r.title) : asObj(r.project_name)

    // type -> minúsculas
    const typeArr = (Array.isArray(r.type) ? r.type : []).map((t) => String(t).toLowerCase())

    const about = asObj(pp.sobreElProyecto)
    const gallery = Array.isArray(pp.gallery) ? pp.gallery : []
    const details = normDetails(pp.projectDetails)
    const moreInfo = (Array.isArray(pp.masInformacion) ? pp.masInformacion : []).slice(0, 3)
    const materials = Array.isArray(pp.materials) ? pp.materials.map((m) => String(m)) : []
    const pageTitle = asObj(pp.pageTitle)
    const pageDescription = asObj(pp.pageDescription)
    const filter = pp.filtro ? String(pp.filtro) : ''
    const folder = pp.folder || extractFolder(r.bg_image) || extractFolder(r.main_image) || extractFolder(gallery[0]?.src) || r.slug || ''
    const hideFromGallery = pp.hideFromGallery === true
    const showOnProjects = gallery.length > 0 || hasText(about) ? true : false

    await sql`
      UPDATE proyectos SET
        title = ${sql.json(titleObj)},
        type = ${typeArr},
        folder = ${folder},
        about_the_project = ${sql.json(about)},
        show_on_projects = ${showOnProjects},
        hide_from_gallery = ${hideFromGallery},
        project_details = ${sql.json(details)},
        gallery = ${sql.json(gallery)},
        more_information = ${sql.json(moreInfo)},
        materials = ${materials},
        page_title = ${sql.json(pageTitle)},
        page_description = ${sql.json(pageDescription)},
        filter = ${filter}
      WHERE id = ${r.id}
    `
    n++
  }
  console.log(`✓ Backfill completado: ${n} filas`)

  // Verificación
  const sample = await sql`SELECT slug, title, type, filter, folder, show_on_projects, hide_from_gallery,
    jsonb_array_length(gallery) AS gallery_n, jsonb_array_length(project_details) AS details_n,
    jsonb_array_length(more_information) AS moreinfo_n, array_length(materials,1) AS materials_n,
    page_title FROM proyectos ORDER BY created_at LIMIT 1`
  console.log('\nEjemplo migrado:', JSON.stringify(sample[0], null, 2))
} catch (e) {
  console.error('ERROR:', e.message)
} finally {
  await sql.end()
}
