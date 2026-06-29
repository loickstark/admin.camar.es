'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { upsertNewsAction } from '@/app/admin/news/actions'
import ImageUploader from '../ImageUploader'
import { deleteFileFromBunny } from '@/lib/bunny-actions'
import AdminLink from '@/components/admin/AdminLink'
import UnsavedChangesGuard from '@/components/admin/UnsavedChangesGuard'
import MarkdownEditor from '@/components/admin/MarkdownEditor'
import { useNotifications } from '@/components/admin/NotificationProvider'
import { Spinner } from '@/components/admin/Spinner'

interface Props {
  initialData?: any
  isEditing?: boolean
  existingFolder?: string
}

export default function NewsForm({ initialData, isEditing, existingFolder }: Props) {
  const router = useRouter()
  const { notify } = useNotifications()
  const [loading, setLoading] = useState(false)

  const PULL_ZONE = "https://lanzadera-digital.b-cdn.net"

  const parseSafe = (data: any, fallback: any) => {
    if (!data) return fallback;
    if (typeof data !== 'string') return data;
    try {
      const parsed = JSON.parse(data);
      return typeof parsed === 'string' ? JSON.parse(parsed) : parsed;
    } catch {
      return fallback;
    }
  };

  const [formData, setFormData] = useState({
    id: initialData?.id || '',
    title: parseSafe(initialData?.title, { es: '', en: '' }),
    slug_es: initialData?.slug_es || '',
    slug_en: initialData?.slug_en || '',
    date: initialData?.date ? new Date(initialData.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
    excerpt: parseSafe(initialData?.excerpt, { es: '', en: '' }),
    content: parseSafe(initialData?.content, { es: '', en: '' }),
    main_image: initialData?.main_image || '',
    gallery: parseSafe(initialData?.gallery, [])
  })

  const slugify = (text: string) =>
    text.toLowerCase().trim()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\w\s-]/g, '').replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');

  // Carpeta de assets en la CDN.
  // - Edición: fija (folder_custom de la BD), no cambia aunque se renombre.
  // - Creación: sigue al slug en vivo, así la subida y la previsualización
  //   apuntan SIEMPRE a la misma ruta (y al guardar, folder_custom == slug_es).
  const folder = isEditing
    ? (initialData?.folder_custom || existingFolder || '')
    : formData.slug_es;

  const getImageUrl = (fileName: string) => {
    if (!fileName) return '';
    if (fileName.startsWith('http')) return fileName;
    const path = folder || 'temp';
    return `${PULL_ZONE}/camar.es/Noticias/${path}/${fileName}`;
  };

  // Detecta si un archivo de la galería es un vídeo por su extensión.
  const isVideoFile = (fileName: string) => /\.(mp4|webm|ogg|ogv|mov|m4v)$/i.test(fileName || '');

  const handleTitleChange = (val: string) => {
    setFormData(prev => ({
      ...prev,
      title: { ...prev.title, es: val },
      slug_es: slugify(val)
    }));
  }

  const handleDeleteImage = (fileName: string, isGallery: boolean, index?: number) => {
    notify({
      tone: 'confirm',
      dismissible: false,
      message: isGallery ? '¿Eliminar este archivo de la galería?' : '¿Eliminar la portada?',
      description: 'Se borrará permanentemente del CDN. Esta acción no se puede deshacer.',
      actions: [
        {
          label: 'Eliminar',
          variant: 'danger',
          onClick: async () => {
            try {
              const res = await deleteFileFromBunny('Noticias', fileName, folder);
              if (res.success || res.status === 404) {
                if (isGallery && index !== undefined) {
                  setFormData(prev => {
                    const newGallery = [...prev.gallery];
                    newGallery.splice(index, 1);
                    return { ...prev, gallery: newGallery };
                  });
                } else {
                  setFormData(prev => ({ ...prev, main_image: '' }));
                }
              } else {
                notify({ tone: 'error', message: 'No se pudo borrar la imagen' });
              }
            } catch {
              notify({ tone: 'error', message: 'Error al borrar la imagen' });
            }
          },
        },
        { label: 'Cancelar', variant: 'ghost' },
      ],
    });
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const data = new FormData()
      data.append('id', formData.id)
      data.append('slug_es', formData.slug_es)
      data.append('slug_en', formData.slug_en || slugify(formData.title.en || formData.slug_es))

      // 4. GUARDAR EXPLÍCITAMENTE folder_custom
      data.append('folder_custom', folder)

      data.append('date', formData.date)
      data.append('main_image', formData.main_image)
      data.append('title', JSON.stringify(formData.title))
      data.append('excerpt', JSON.stringify(formData.excerpt))
      data.append('content', JSON.stringify(formData.content))
      data.append('gallery', JSON.stringify(formData.gallery))

      const result = await upsertNewsAction(data)
      if (result?.success) {
        router.push('/admin/news')
        router.refresh()
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-6xl space-y-10 pb-20">
      <UnsavedChangesGuard />

      {/* HEADER */}
      <div className="flex items-end justify-between gap-6">
        <div>
          <AdminLink href="/admin/news" className="mb-4 block text-xs uppercase tracking-widest text-dynamicBlack/50 default-transition hover:text-bubonicBrown">
            Volver al listado
          </AdminLink>
          <h1 className="font-vollkorn text-3xl uppercase leading-tight tracking-tight text-dynamicBlack">
            {isEditing ? (initialData?.title?.es || 'Editar noticia') : 'Nueva noticia'}
          </h1>
        </div>
        <button type="submit" disabled={loading} aria-busy={loading} className="btn-primary">
          {loading && <Spinner />}
          {loading ? 'Guardando…' : (isEditing ? 'Actualizar noticia' : 'Publicar noticia')}
        </button>
      </div>

      {/* FECHA DE PUBLICACIÓN */}
      <section className="card">
        <label className="label">Fecha de publicación</label>
        <input
          type="date"
          className="input max-w-xs"
          value={formData.date}
          onChange={e => setFormData({...formData, date: e.target.value})}
        />
      </section>

      {/* MULTIMEDIA */}
      <section className="rounded-xl border border-dynamicBlack/10 bg-baliPearl p-8">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-4">

          <div className="space-y-4 lg:col-span-1">
            <label className="label">Portada</label>
            {formData.main_image ? (
              <div className="group relative aspect-4/5 overflow-hidden rounded-xl border border-dynamicBlack/10 bg-white">
                <img src={getImageUrl(formData.main_image)} className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110" alt="Main" />
                <button
                  type="button"
                  onClick={() => handleDeleteImage(formData.main_image, false)}
                  className="absolute inset-0 flex cursor-pointer flex-col items-center justify-center bg-red-600/90 text-baliPearl opacity-0 default-transition group-hover:opacity-100"
                >
                  <span className="text-xs font-bold uppercase tracking-wide">Eliminar archivo</span>
                </button>
              </div>
            ) : (
              <div className="aspect-4/5">
                {folder ? (
                  <ImageUploader
                    folder={`Noticias/${folder}` as any}
                    label="Sube la portada principal"
                    onUploadSuccess={(file) => setFormData(prev => ({ ...prev, main_image: file }))}
                  />
                ) : (
                  <div className="flex h-full items-center justify-center rounded-md border-2 border-dashed border-dynamicBlack/15 p-6 text-center text-[10px] uppercase italic leading-relaxed text-dynamicBlack/40">
                    Escribe primero el título de la noticia para poder subir la portada
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="space-y-4 lg:col-span-3">
            <label className="label">Galería</label>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-5">
              {formData.gallery.map((item: any, idx: number) => {
                const src = typeof item === 'string' ? item : item.src;
                const isVideo = (typeof item === 'object' && item?.type === 'video') || isVideoFile(src);
                return (
                  <div key={idx} className="group relative aspect-square overflow-hidden rounded-md border border-dynamicBlack/10 bg-white">
                    {isVideo ? (
                      <>
                        <video src={getImageUrl(src)} className="h-full w-full object-cover" muted playsInline preload="metadata" />
                        <span className="pointer-events-none absolute left-1 top-1 rounded bg-dynamicBlack/70 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide text-baliPearl">Vídeo</span>
                      </>
                    ) : (
                      <img src={getImageUrl(src)} className="h-full w-full object-cover" alt={`Gal ${idx}`} />
                    )}
                    <button
                      type="button"
                      onClick={() => handleDeleteImage(src, true, idx)}
                      className="absolute inset-0 flex cursor-pointer items-center justify-center bg-red-600/95 text-[9px] font-bold uppercase tracking-wide text-baliPearl opacity-0 default-transition group-hover:opacity-100"
                    >
                      Borrar
                    </button>
                  </div>
                )
              })}
              <div className="aspect-square">
                {folder ? (
                  <ImageUploader
                    folder={`Noticias/${folder}` as any}
                    label="+"
                    accept="image/*,video/*"
                    onUploadSuccess={(file) => setFormData(prev => ({...prev, gallery: [...prev.gallery, { src: file, type: isVideoFile(file) ? 'video' : 'image' }]}))}
                  />
                ) : (
                  <div className="flex h-full items-center justify-center rounded-md border-2 border-dashed border-dynamicBlack/15 p-2 text-center text-[9px] uppercase italic leading-tight text-dynamicBlack/40">
                    Añade un título primero
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CONTENIDO IDIOMAS */}
      <div className="grid grid-cols-1 gap-8 xl:grid-cols-2">
        {/* Castellano */}
        <section className="card space-y-6">
          <div className="flex items-center gap-3">
            <span className="h-3 w-3 rounded-full bg-bubonicBrown"></span>
            <span className="font-vollkorn text-sm uppercase tracking-widest text-dynamicBlack/60">Castellano</span>
          </div>
          <div>
            <input
              placeholder="Título de la noticia..."
              className={`w-full border-0 border-b-2 border-dynamicBlack/10 bg-transparent pb-4 font-vollkorn text-lg outline-none default-transition placeholder:text-dynamicBlack/20 focus:border-bubonicBrown ${
                isEditing ? 'cursor-not-allowed text-dynamicBlack/50' : 'text-dynamicBlack'
              }`}
              value={formData.title.es}
              onChange={(e) => handleTitleChange(e.target.value)}
              readOnly={isEditing}
              title={isEditing ? 'El título no se puede cambiar una vez publicada la noticia' : undefined}
              required
            />
            {isEditing && (
              <p className="mt-2 text-[11px] italic text-dynamicBlack/40">
                El título no se puede modificar una vez publicada la noticia.
              </p>
            )}
          </div>
          <div>
            <label className="label">Contenido</label>
            <MarkdownEditor
              value={formData.content.es}
              placeholder="Cuerpo de la noticia..."
              onChange={(val) => setFormData(prev => ({...prev, content: {...prev.content, es: val}}))}
            />
          </div>
        </section>

        {/* Inglés */}
        <section className="card space-y-6 bg-baliPearl">
          <div className="flex items-center gap-3">
            <span className="h-3 w-3 rounded-full bg-dynamicBlack"></span>
            <span className="font-vollkorn text-sm uppercase tracking-widest text-dynamicBlack/60">English</span>
          </div>
          <div>
            <input
              placeholder="News headline..."
              className={`w-full border-0 border-b-2 border-dynamicBlack/10 bg-transparent pb-4 font-vollkorn text-lg outline-none default-transition placeholder:text-dynamicBlack/20 focus:border-dynamicBlack ${
                isEditing ? 'cursor-not-allowed text-dynamicBlack/50' : 'text-dynamicBlack'
              }`}
              value={formData.title.en}
              onChange={(e) => setFormData({...formData, title: {...formData.title, en: e.target.value}})}
              readOnly={isEditing}
              title={isEditing ? 'El título no se puede cambiar una vez publicada la noticia' : undefined}
            />
            {isEditing && (
              <p className="mt-2 text-[11px] italic text-dynamicBlack/40">
                The title can&apos;t be changed once the article is published.
              </p>
            )}
          </div>
          <div>
            <label className="label">Content</label>
            <MarkdownEditor
              value={formData.content.en}
              placeholder="News body content..."
              onChange={(val) => setFormData(prev => ({...prev, content: {...prev.content, en: val}}))}
            />
          </div>
        </section>
      </div>

    </form>
  )
}
