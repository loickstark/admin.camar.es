import 'server-only'
import { supabase } from './supabase'

// Tras MAX_ATTEMPTS fallos desde una misma IP dentro de WINDOW_MINUTES, se bloquea
// hasta que la ventana se renueve. Se limita por IP (no por email) para que nadie
// pueda bloquear a un admin legítimo machacando su correo.
const MAX_ATTEMPTS = 8
const WINDOW_MINUTES = 15

// Crea la tabla la primera vez (memoizado: solo se ejecuta una vez por instancia).
let ensured: Promise<void> | null = null
function ensureTable(): Promise<void> {
  if (!ensured) {
    ensured = (async () => {
      await supabase`
        CREATE TABLE IF NOT EXISTS login_attempts (
          id bigserial PRIMARY KEY,
          ip text NOT NULL,
          created_at timestamptz NOT NULL DEFAULT now()
        )
      `
      await supabase`
        CREATE INDEX IF NOT EXISTS idx_login_attempts_ip_created
        ON login_attempts (ip, created_at)
      `
    })().catch((e) => {
      ensured = null // Permite reintentar la creación en la siguiente llamada.
      throw e
    })
  }
  return ensured
}

export interface RateLimitResult {
  allowed: boolean
  retryAfterMinutes: number
}

/**
 * Comprueba si una IP ha superado el límite de intentos fallidos recientes.
 * No registra nada. Si la infraestructura falla, deja pasar (fail-open) para no
 * bloquear al admin legítimo por un fallo transitorio de la BD.
 */
export async function checkLoginRateLimit(ip: string): Promise<RateLimitResult> {
  try {
    await ensureTable()
    const rows = await supabase`
      SELECT COUNT(*)::int AS count
      FROM login_attempts
      WHERE ip = ${ip}
        AND created_at > now() - make_interval(mins => ${WINDOW_MINUTES})
    `
    const count: number = rows[0]?.count ?? 0
    return { allowed: count < MAX_ATTEMPTS, retryAfterMinutes: WINDOW_MINUTES }
  } catch (e) {
    console.error('Rate limit check falló (se deja pasar):', e)
    return { allowed: true, retryAfterMinutes: WINDOW_MINUTES }
  }
}

/** Registra un intento fallido y purga los antiguos. Best-effort: nunca lanza. */
export async function recordLoginFailure(ip: string): Promise<void> {
  try {
    await ensureTable()
    await supabase`INSERT INTO login_attempts (ip) VALUES (${ip})`
    // Mantiene la tabla pequeña: borra lo que ya cae fuera de la ventana.
    await supabase`
      DELETE FROM login_attempts
      WHERE created_at < now() - make_interval(mins => ${WINDOW_MINUTES})
    `
  } catch (e) {
    console.error('No se pudo registrar el intento fallido:', e)
  }
}

/** Limpia los intentos de una IP tras un login correcto. Best-effort: nunca lanza. */
export async function clearLoginFailures(ip: string): Promise<void> {
  try {
    await ensureTable()
    await supabase`DELETE FROM login_attempts WHERE ip = ${ip}`
  } catch (e) {
    console.error('No se pudieron limpiar los intentos:', e)
  }
}
