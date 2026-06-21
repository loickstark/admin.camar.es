'use client'

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'

/* ==========================================================================
   Tipos — se ampliarán las categorías más adelante
   ========================================================================== */
export type NotificationTone = 'default' | 'confirm' | 'error' | 'success'

export interface NotificationAction {
  label: string
  /** Recibe el valor del campo de texto si la notificación tiene `input` */
  onClick?: (inputValue?: string) => void
  /** primary = dorado, danger = rojo, ghost = contorno */
  variant?: 'primary' | 'danger' | 'ghost'
  /** Por defecto la notificación se cierra al pulsar la acción */
  keepOpen?: boolean
}

export interface NotificationField {
  placeholder?: string
  defaultValue?: string
  type?: string
}

export interface NotificationInput {
  message: string
  description?: string
  tone?: NotificationTone
  actions?: NotificationAction[]
  /** Muestra botón de cerrar (X). Por defecto true */
  dismissible?: boolean
  /** Si se define, muestra un campo de texto dentro de la notificación */
  input?: NotificationField
}

interface Notification extends NotificationInput {
  id: number
}

interface NotificationContextType {
  notify: (input: NotificationInput) => void
  dismiss: () => void
}

const NotificationContext = createContext<NotificationContextType>({
  notify: () => {},
  dismiss: () => {},
})

export function useNotifications() {
  return useContext(NotificationContext)
}

/* ==========================================================================
   Estilos por tono / variante
   ========================================================================== */
const TONE_DOT: Record<NotificationTone, string> = {
  default: 'bg-baliPearl/60',
  confirm: 'bg-bubonicBrown',
  error: 'bg-red-500',
  success: 'bg-green-500',
}

const ACTION_CLASS: Record<NonNullable<NotificationAction['variant']>, string> = {
  primary: 'bg-bubonicBrown text-baliPearl hover:bg-rawSienna',
  danger: 'bg-red-600 text-baliPearl hover:bg-red-700',
  ghost: 'border border-baliPearl/30 text-baliPearl hover:bg-secondaryBlack',
}

/* ==========================================================================
   Provider + Banner
   ========================================================================== */
const AUTO_DISMISS_MS = 3000
const EXIT_MS = 300

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [notification, setNotification] = useState<Notification | null>(null)
  const [closing, setClosing] = useState(false)
  const [inputValue, setInputValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const autoTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const exitTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearTimers = () => {
    if (autoTimer.current) clearTimeout(autoTimer.current)
    if (exitTimer.current) clearTimeout(exitTimer.current)
    autoTimer.current = null
    exitTimer.current = null
  }

  // Cierra con animación de salida (hacia abajo, fuera del viewport)
  const dismiss = useCallback(() => {
    clearTimers()
    setClosing(true)
    exitTimer.current = setTimeout(() => {
      setNotification(null)
      setClosing(false)
    }, EXIT_MS)
  }, [])

  const notify = useCallback(
    (input: NotificationInput) => {
      clearTimers()
      setClosing(false)
      setInputValue(input.input?.defaultValue ?? '')
      setNotification({ id: Date.now(), ...input })
      // Sin CTA (solo cierre): se auto-descarta. Si hay campo de texto, se mantiene.
      if ((!input.actions || input.actions.length === 0) && !input.input) {
        autoTimer.current = setTimeout(() => dismiss(), AUTO_DISMISS_MS)
      }
    },
    [dismiss],
  )

  useEffect(() => () => clearTimers(), [])

  // Autofoco del campo de texto en cuanto aparece la notificación
  useEffect(() => {
    if (notification?.input && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [notification?.id, notification?.input])

  if (!notification) {
    return (
      <NotificationContext.Provider value={{ notify, dismiss }}>{children}</NotificationContext.Provider>
    )
  }

  const triggerAction = (action: NotificationAction) => {
    action.onClick?.(inputValue)
    if (!action.keepOpen) dismiss()
  }

  const messageBlock = (
    <div className="flex items-start gap-3">
      <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${TONE_DOT[notification.tone || 'default']}`} />
      <div>
        <p className="font-vollkorn text-sm uppercase tracking-wide text-baliPearl">{notification.message}</p>
        {notification.description && <p className="mt-1 text-sm text-baliPearl/60">{notification.description}</p>}
      </div>
    </div>
  )

  const actionButtons = notification.actions?.map((action, i) => (
    <button
      key={i}
      type="button"
      onClick={() => triggerAction(action)}
      className={`cursor-pointer rounded-md px-4 py-2 font-vollkorn text-xs uppercase tracking-wide default-transition ${
        ACTION_CLASS[action.variant || 'ghost']
      }`}
    >
      {action.label}
    </button>
  ))

  const closeButton = (notification.dismissible ?? true) && (
    <button
      type="button"
      onClick={dismiss}
      aria-label="Cerrar"
      className="cursor-pointer rounded-md p-2 text-baliPearl/50 default-transition hover:bg-secondaryBlack hover:text-baliPearl"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
        <path d="M18 6 6 18M6 6l12 12" />
      </svg>
    </button>
  )

  return (
    <NotificationContext.Provider value={{ notify, dismiss }}>
      {children}

      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-200 flex justify-center px-4 pb-6">
        <div
          key={notification.id}
          className={`pointer-events-auto w-full max-w-2xl rounded-xl border border-secondaryBlack bg-dynamicBlack px-6 py-4 text-baliPearl shadow-2xl ${
            closing ? 'animate-notif-out' : 'animate-notif'
          }`}
          role="alertdialog"
          aria-live="assertive"
        >
          {notification.input ? (
            <div className="flex flex-col gap-3">
              <div className="flex items-start justify-between gap-4">
                {messageBlock}
                {closeButton}
              </div>
              <input
                ref={inputRef}
                type={notification.input.type || 'text'}
                value={inputValue}
                placeholder={notification.input.placeholder}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    const primary =
                      notification.actions?.find((a) => a.variant === 'primary') || notification.actions?.[0]
                    if (primary) triggerAction(primary)
                  }
                }}
                className="w-full rounded-md border border-secondaryBlack bg-secondaryBlack/50 px-3 py-2 text-sm text-baliPearl outline-none default-transition placeholder:text-baliPearl/40 focus:border-bubonicBrown"
              />
              <div className="flex items-center gap-2 sm:justify-end">{actionButtons}</div>
            </div>
          ) : (
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              {messageBlock}
              <div className="flex shrink-0 items-center gap-2 sm:justify-end">
                {actionButtons}
                {closeButton}
              </div>
            </div>
          )}
        </div>
      </div>
    </NotificationContext.Provider>
  )
}
