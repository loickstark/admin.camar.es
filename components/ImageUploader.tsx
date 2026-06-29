// /components/ImageUploader.tsx
'use client'
import { useState } from 'react'

interface Props {
  folder: 'Materiales' | 'Noticias' | 'Proyectos'
  onUploadSuccess: (fileName: string) => void
  label?: string
  // Restringe el tipo de archivo del selector (p. ej. "image/*" o "image/*,video/*").
  accept?: string
}

export default function ImageUploader({ folder, onUploadSuccess, label, accept }: Props) {
  const [status, setStatus] = useState<'idle' | 'uploading' | 'success'>('idle')

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0]) return

    setStatus('uploading')
    const file = e.target.files[0]

    // Limpieza de nombre: "Casa Irlanda.JPG" -> "casa-irlanda.jpg"
    const cleanName = file.name.toLowerCase()
      .replace(/\s+/g, '-')
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "");

    try {
      const res = await fetch(`/api/upload?file=${cleanName}&folder=${folder}`, {
        method: 'PUT',
        body: file,
        credentials: 'same-origin', // envía la cookie de sesión
      })

      if (res.ok) {
        setStatus('success')
        onUploadSuccess(cleanName)
        setTimeout(() => setStatus('idle'), 3000)
      } else {
        let detail = ''
        try { detail = (await res.json())?.error ?? '' } catch {}
        console.error('Fallo en la subida', res.status, detail)
        alert(`Error en la subida (${res.status})${detail ? `: ${detail}` : ''}`)
        setStatus('idle')
      }
    } catch (err) {
      console.error('Error de conexión en la subida', err)
      setStatus('idle')
      alert("Error de conexión")
    }
  }

  return (
    <div className={`relative flex min-h-full cursor-pointer items-center justify-center rounded-md border-2 border-dashed p-6 default-transition
      ${status === 'uploading' ? 'border-bubonicBrown bg-bubonicBrown/5' :
        status === 'success' ? 'border-green-500 bg-green-50' : 'border-dynamicBlack/15 bg-white hover:bg-secondaryGray'}`}>

      <input type="file" accept={accept} className="absolute inset-0 cursor-pointer opacity-0" onChange={handleUpload} disabled={status === 'uploading'} />

      <div className="text-center">
        {status === 'idle' && (
          <>
            <p className="font-vollkorn text-xs uppercase tracking-wide text-dynamicBlack/70">{label || `Subir a ${folder}`}</p>
            <p className="mt-1 text-[10px] text-dynamicBlack/40">Arrastra o haz clic aquí</p>
          </>
        )}
        {status === 'uploading' && <p className="animate-bounce text-xs font-bold uppercase tracking-widest text-bubonicBrown">Subiendo...</p>}
        {status === 'success' && <p className="text-xs font-bold uppercase tracking-widest text-green-700">¡Subido con éxito!</p>}
      </div>
    </div>
  )
}
