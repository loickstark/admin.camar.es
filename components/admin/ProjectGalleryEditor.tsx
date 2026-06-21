'use client'

import { useState } from 'react'
import ImageUploader from '../ImageUploader'
import { deleteFileFromBunny } from '@/lib/bunny-actions'
import { useNotifications } from '@/components/admin/NotificationProvider'

interface GalleryItem { src: string; type: string }

interface Props {
  folder: string
  initialBg?: string
  initialMain?: string
  initialGallery?: GalleryItem[]
}

const CDN_BASE = 'https://lanzadera-digital.b-cdn.net'

export default function ProjectGalleryEditor({ folder, initialBg = '', initialMain = '', initialGallery = [] }: Props) {
  const [bg, setBg] = useState(initialBg)
  const [main, setMain] = useState(initialMain)
  const [gallery, setGallery] = useState<GalleryItem[]>(initialGallery)
  const { notify } = useNotifications()

  const buildUrl = (fileName: string) => `${CDN_BASE}/camar.es/Proyectos/${folder}/${fileName}`
  const uploadFolder = `Proyectos/${folder}` as any

  const removeGalleryImage = (index: number) => {
    const item = gallery[index]
    const fileName = (typeof item === 'string' ? item : item.src).split('/').pop()
    notify({
      tone: 'confirm',
      dismissible: false,
      message: '¿Eliminar esta imagen de la galería?',
      description: 'Esta acción no se puede deshacer.',
      actions: [
        {
          label: 'Eliminar',
          variant: 'danger',
          onClick: async () => {
            try {
              const res = await deleteFileFromBunny('Proyectos', fileName!, folder)
              if (res.success || res.status === 404) {
                setGallery((prev) => prev.filter((_, i) => i !== index))
              }
            } catch {
              notify({ tone: 'error', message: 'No se pudo eliminar la imagen.' })
            }
          },
        },
        { label: 'Cancelar', variant: 'ghost' },
      ],
    })
  }

  return (
    <section className="space-y-8 rounded-xl border border-dynamicBlack/10 bg-baliPearl p-8">
      <h3 className="flex items-center gap-2 font-vollkorn text-sm uppercase tracking-widest text-dynamicBlack/60">
        <span className="h-2 w-2 rounded-full bg-bubonicBrown"></span> Multimedia
      </h3>

      {/* Portada + Segunda imagen */}
      <div className="grid grid-cols-1 gap-8 sm:grid-cols-2">
        <SingleImage
          label="Portada"
          value={bg}
          onUpload={(f) => setBg(buildUrl(f))}
          onClear={() => setBg('')}
          uploadFolder={uploadFolder}
        />
        <SingleImage
          label="Segunda imagen"
          value={main}
          onUpload={(f) => setMain(buildUrl(f))}
          onClear={() => setMain('')}
          uploadFolder={uploadFolder}
        />
      </div>

      {/* Galería */}
      <div className="space-y-4">
        <label className="label">Galería ({gallery.length})</label>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {gallery.map((img, idx) => {
            const src = typeof img === 'string' ? img : img.src
            return (
              <div key={idx} className="group relative aspect-square overflow-hidden rounded-md border border-dynamicBlack/10 bg-white">
                <img src={src} className="h-full w-full object-cover" alt={`Galería ${idx}`} />
                <button
                  type="button"
                  onClick={() => removeGalleryImage(idx)}
                  className="absolute inset-0 flex cursor-pointer items-center justify-center bg-red-600/90 text-[10px] font-bold uppercase tracking-wide text-baliPearl opacity-0 default-transition group-hover:opacity-100"
                >
                  Eliminar
                </button>
              </div>
            )
          })}
          <div className="aspect-square">
            <ImageUploader
              folder={uploadFolder}
              label="+"
              onUploadSuccess={(f) => setGallery((prev) => [...prev, { type: 'image', src: buildUrl(f) }])}
            />
          </div>
        </div>
      </div>

      {/* Hidden inputs para el form */}
      <input type="hidden" name="bg_image" value={bg} />
      <input type="hidden" name="main_image" value={main} />
      <input type="hidden" name="gallery" value={JSON.stringify(gallery)} />
    </section>
  )
}

function SingleImage({
  label,
  value,
  onUpload,
  onClear,
  uploadFolder,
}: {
  label: string
  value: string
  onUpload: (fileName: string) => void
  onClear: () => void
  uploadFolder: string
}) {
  return (
    <div className="space-y-3">
      <label className="label">{label}</label>
      {value ? (
        <div className="relative aspect-video overflow-hidden rounded-xl border border-dynamicBlack/10 bg-white">
          <img src={value} className="h-full w-full object-cover" alt={label} />
          <button
            type="button"
            onClick={onClear}
            className="absolute right-2 top-2 cursor-pointer rounded-md bg-baliPearl/90 p-1.5 text-dynamicBlack/60 backdrop-blur default-transition hover:text-red-600"
            title="Quitar"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      ) : (
        <div className="aspect-video">
          <ImageUploader folder={uploadFolder as any} onUploadSuccess={onUpload} />
        </div>
      )}
    </div>
  )
}
