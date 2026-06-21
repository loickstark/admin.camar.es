import 'server-only'

/**
 * Dispara los deploy hooks (rebuild del front) cuando hay un cambio de contenido.
 *
 * Se envía a DOS destinos (un deploy por cada uno):
 *   - DEPLOY_HOOK_URL     -> hook ya existente
 *   - DEPLOY_HOOK_URL_2   -> Cloudflare Pages (usa el default de abajo si no se define)
 *
 * Controlado por flag para no redeployar en desarrollo:
 *   - DEPLOY_HOOK_ENABLED=true   -> activa el envío
 *
 * Nunca lanza: el fallo de un hook no debe romper el guardado ni impedir el otro.
 */

// Cloudflare Pages deploy hook (se puede sobreescribir con DEPLOY_HOOK_URL_2).
const CLOUDFLARE_DEPLOY_HOOK =
  'https://api.cloudflare.com/client/v4/pages/webhooks/deploy_hooks/2000af56-8ffd-4cb0-9902-2e894f90a671'

async function fire(url: string) {
  let host = 'hook'
  try {
    host = new URL(url).host
  } catch {}

  try {
    const res = await fetch(url, { method: 'POST' })
    if (res.ok) {
      console.log(`🚀 Deploy hook disparado (${host})`)
    } else {
      console.error(`Deploy hook (${host}) respondió`, res.status)
    }
  } catch (error) {
    console.error(`No se pudo disparar el deploy hook (${host}):`, error)
  }
}

export async function triggerDeploy() {
  if (process.env.DEPLOY_HOOK_ENABLED !== 'true') return

  const urls = [
    process.env.DEPLOY_HOOK_URL,
    process.env.DEPLOY_HOOK_URL_2 || CLOUDFLARE_DEPLOY_HOOK,
  ].filter((u): u is string => Boolean(u))

  if (urls.length === 0) return

  // En paralelo y aislados: un hook que falle no impide el otro.
  await Promise.allSettled(urls.map(fire))
}
