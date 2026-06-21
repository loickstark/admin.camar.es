// DESTRUCTIVO: elimina las columnas legacy de proyectos (project_name, project_page).
// Ejecutar SOLO cuando el front (Astro) ya esté desplegado leyendo las columnas nuevas.
// Uso: node scripts/projects-drop-legacy.mjs
import postgres from 'postgres'
import fs from 'fs'

const env = fs.readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
const url = env.split('\n').find((l) => l.startsWith('DATABASE_URL=')).replace('DATABASE_URL=', '').trim().replace(/^["']|["']$/g, '')
const sql = postgres(url, { ssl: 'require' })

try {
  await sql`ALTER TABLE proyectos DROP COLUMN IF EXISTS project_name`
  await sql`ALTER TABLE proyectos DROP COLUMN IF EXISTS project_page`
  console.log('✓ Columnas legacy eliminadas: project_name, project_page')
} catch (e) {
  console.error('ERROR:', e.message)
} finally {
  await sql.end()
}
