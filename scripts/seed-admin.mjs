// Crea o actualiza un usuario admin.
//
// Uso:
//   node scripts/seed-admin.mjs <email> <password>   -> datos por argumentos
//   node scripts/seed-admin.mjs                       -> usa ADMIN_EMAIL / ADMIN_PASSWORD de .env.local
//
// Si el email ya existe, le resetea la contraseña; si no, lo crea.
// DATABASE_URL se lee siempre de .env.local.
import postgres from 'postgres'
import { scrypt, randomBytes, randomUUID } from 'crypto'
import { promisify } from 'util'
import fs from 'fs'

const scryptAsync = promisify(scrypt)

function readEnv(k) {
  const env = fs.readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
  const line = env.split('\n').find((l) => l.startsWith(k + '='))
  return line ? line.slice(k.length + 1).trim().replace(/^["']|["']$/g, '') : undefined
}

async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex')
  const buf = await scryptAsync(password, salt, 64)
  return `${salt}:${buf.toString('hex')}`
}

// Argumentos de línea de comandos; si faltan, se cae a .env.local.
const [argEmail, argPassword] = process.argv.slice(2)
const url = readEnv('DATABASE_URL')
const email = (argEmail || readEnv('ADMIN_EMAIL') || '').trim().toLowerCase()
const password = argPassword ?? readEnv('ADMIN_PASSWORD') ?? ''

if (!url) {
  console.error('Falta DATABASE_URL en .env.local')
  process.exit(1)
}
if (!email || !password) {
  console.error('Uso: node scripts/seed-admin.mjs <email> <password>')
  console.error('     (o define ADMIN_EMAIL y ADMIN_PASSWORD en .env.local)')
  process.exit(1)
}
if (!email.includes('@')) {
  console.error(`Email no válido: ${email}`)
  process.exit(1)
}
if (password.length < 8) {
  console.error('La contraseña debe tener al menos 8 caracteres.')
  process.exit(1)
}

const sql = postgres(url, { ssl: 'require' })
try {
  const existing = await sql`SELECT 1 FROM admin_users WHERE email = ${email} LIMIT 1`
  const password_hash = await hashPassword(password)
  await sql`
    INSERT INTO admin_users (id, email, password_hash)
    VALUES (${randomUUID()}, ${email}, ${password_hash})
    ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash
  `
  console.log(`✓ Usuario ${existing.length ? 'actualizado (contraseña reseteada)' : 'creado'}: ${email}`)
} catch (e) {
  console.error('ERROR:', e.message)
  process.exitCode = 1
} finally {
  await sql.end()
}
