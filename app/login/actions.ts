'use server'

import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { supabase } from '@/lib/supabase'
import { verifyPassword } from '@/lib/password'
import { createSession, deleteSession } from '@/lib/auth'
import { checkLoginRateLimit, recordLoginFailure, clearLoginFailures } from '@/lib/rate-limit'

export interface LoginState {
  error?: string
}

/** IP real del cliente a partir de las cabeceras del proxy/CDN. */
async function getClientIp(): Promise<string> {
  const h = await headers()
  return (
    h.get('cf-connecting-ip') ||
    h.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    h.get('x-real-ip') ||
    'unknown'
  )
}

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = (formData.get('email') as string || '').trim().toLowerCase()
  const password = (formData.get('password') as string) || ''

  if (!email || !password) {
    return { error: 'Introduce email y contraseña.' }
  }

  // Rate limiting por IP: frena la fuerza bruta sobre la contraseña.
  const ip = await getClientIp()
  const limit = await checkLoginRateLimit(ip)
  if (!limit.allowed) {
    return { error: `Demasiados intentos. Espera unos ${limit.retryAfterMinutes} minutos e inténtalo de nuevo.` }
  }

  let user: { id: string; password_hash: string } | undefined
  try {
    const rows = await supabase`
      SELECT id, password_hash FROM admin_users WHERE email = ${email} LIMIT 1
    `
    user = rows[0] as any
  } catch (e) {
    console.error('Error consultando admin_users:', e)
    return { error: 'Error del servidor. Inténtalo de nuevo.' }
  }

  // Comprueba siempre el hash (aunque no exista el usuario) para no filtrar tiempos
  const ok = user ? await verifyPassword(password, user.password_hash) : false
  if (!user || !ok) {
    await recordLoginFailure(ip)
    return { error: 'Credenciales incorrectas.' }
  }

  await clearLoginFailures(ip)
  await createSession(user.id)
  redirect('/admin/materials')
}

export async function logout() {
  await deleteSession()
  redirect('/login')
}
