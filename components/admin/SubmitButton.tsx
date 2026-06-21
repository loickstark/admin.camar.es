'use client'

import { useFormStatus } from 'react-dom'
import { Spinner } from './Spinner'

interface Props {
  children: React.ReactNode
  /** Texto mientras se envía. Por defecto "Guardando…". */
  pendingLabel?: string
  className?: string
}

/**
 * Botón de envío para formularios con server action (`<form action={...}>`).
 * Mientras la acción está en curso muestra un spinner y se deshabilita, lo que
 * evita envíos duplicados/acumulados cuando el guardado tarda.
 *
 * Debe renderizarse DENTRO del <form> (usa useFormStatus).
 */
export function SubmitButton({ children, pendingLabel = 'Guardando…', className = 'btn-primary' }: Props) {
  const { pending } = useFormStatus()

  return (
    <button type="submit" disabled={pending} aria-busy={pending} className={className}>
      {pending && <Spinner />}
      {pending ? pendingLabel : children}
    </button>
  )
}
