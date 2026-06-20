'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { upsertNewsAction } from '@/app/admin/news/actions'
import ImageUploader from '../ImageUploader'
import { deleteFileFromBunny } from '@/lib/bunny-actions'

interface Props {
  initialData?: any
  isEditing?: boolean
  existingFolder?: string 
}

export default function NewsForm({ initialData, isEditing, existingFolder }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  
  const PULL_ZONE = "https://lanzadera-digital.b-cdn.net"

  // 1. PRIORIDAD ABSOLUTA: folder_custom de la base de datos
  const [folderName, setFolderName] = useState(initialData?.folder_custom || existingFolder || '');

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

  // 2. SOLO GENERAR FOLDER SI ES NUEVA NOTICIA
  useEffect(() => {
    if (isEditing || folderName) return; 
    if (formData.title.es) {
      setFolderName(slugify(formData.title.es));
    }
  }, [formData.title.es, isEditing, folderName]);

  // 3. RUTA DE IMAGEN: Usa folderName que es folder_custom
  const getImageUrl = (fileName: string) => {
    if (!fileName) return '';
    if (fileName.startsWith('http')) return fileName;
    const path = folderName || slugify(formData.title.es) || 'temp';
    return `${PULL_ZONE}/camar.es/Noticias/${path}/${fileName}`;
  };

  const handleTitleChange = (val: string) => {
    setFormData(prev => ({
      ...prev,
      title: { ...prev.title, es: val },
      slug_es: slugify(val) 
    }));
  }

  const handleDeleteImage = async (fileName: string, isGallery: boolean, index?: number) => {
    if (!confirm("¿Borrar permanentemente del CDN?")) return;
    try {
      const res = await deleteFileFromBunny('Noticias', fileName, folderName);
      if (res.success || res.status === 404) {
        if (isGallery && index !== undefined) {
          const newGallery = [...formData.gallery];
          newGallery.splice(index, 1);
          setFormData(prev => ({ ...prev, gallery: newGallery }));
        } else {
          setFormData(prev => ({ ...prev, main_image: '' }));
        }
      }
    } catch (error) {
      alert("Error al borrar");
    }
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
      data.append('folder_custom', folderName) 
      
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
    <form onSubmit={handleSubmit} className="space-y-12 pb-32">
      
      {/* INFO RUTA - Debug Visual */}
      <section className="bg-slate-900 p-6 rounded-[2.5rem] border border-slate-800 shadow-2xl">
        <div className="flex items-center gap-5">
          <div className="bg-emerald-500/10 w-12 h-12 rounded-2xl flex items-center justify-center text-emerald-500 border border-emerald-500/20">
            {isEditing ? '🔒' : '📂'}
          </div>
          <div>
            <p className="text-[10px] font-black uppercase text-slate-500 tracking-[0.3em]">
              Storage Path (folder_custom)
            </p>
            <p className="font-mono text-xs text-emerald-400">/Noticias/{folderName || 'generando...'}/</p>
          </div>
        </div>
      </section>

      {/* MULTIMEDIA */}
      <section className="bg-slate-50 p-8 rounded-[3.5rem] border border-slate-200 shadow-inner">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-12">
          
          <div className="lg:col-span-1 space-y-4">
            <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Portada</label>
            <div className="aspect-[4/5] bg-white rounded-[2.5rem] overflow-hidden border-2 border-slate-200 relative group shadow-lg">
              {formData.main_image ? (
                <>
                  <img src={getImageUrl(formData.main_image)} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" alt="Main" />
                  <button 
                    type="button"
                    onClick={() => handleDeleteImage(formData.main_image, false)}
                    className="absolute inset-0 bg-red-600/90 opacity-0 group-hover:opacity-100 transition-all flex flex-col items-center justify-center text-white"
                  >
                    <span className="font-black text-xs">ELIMINAR ARCHIVO</span>
                  </button>
                </>
              ) : (
                <div className="flex items-center justify-center h-full text-[10px] text-slate-300 font-bold uppercase p-10 text-center italic leading-relaxed">Sube la portada principal</div>
              )}
            </div>
            <ImageUploader 
              folder={`Noticias/${folderName}` as any} 
              onUploadSuccess={(file) => setFormData({...formData, main_image: file})} 
            />
          </div>
          
          <div className="lg:col-span-3 space-y-4">
            <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Galería de Imágenes</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
              {formData.gallery.map((item: any, idx: number) => {
                const src = typeof item === 'string' ? item : item.src;
                return (
                  <div key={idx} className="aspect-square bg-white rounded-3xl overflow-hidden border border-slate-200 relative group shadow-sm hover:shadow-md transition-shadow">
                    <img src={getImageUrl(src)} className="w-full h-full object-cover" alt={`Gal ${idx}`} />
                    <button 
                      type="button" 
                      onClick={() => handleDeleteImage(src, true, idx)} 
                      className="absolute inset-0 bg-red-600/95 text-white opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center font-black text-[9px]"
                    >
                      BORRAR
                    </button>
                  </div>
                )
              })}
              <div className="aspect-square">
                <ImageUploader 
                  folder={`Noticias/${folderName}` as any} 
                  label="+"
                  onUploadSuccess={(file) => setFormData({...formData, gallery: [...formData.gallery, { src: file, type: 'image' }]})} 
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CONTENIDO IDIOMAS */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-12">
        {/* Castellano */}
        <section className="space-y-8 bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <span className="w-4 h-4 bg-yellow-400 rounded-full shadow-[0_0_15px_rgba(250,204,21,0.5)]"></span>
            <span className="text-xs font-black uppercase tracking-widest text-slate-400">Castellano</span>
          </div>
          <div className="space-y-6">
            <input 
              placeholder="Título de la noticia..."
              className="w-full text-4xl font-black bg-transparent border-b-2 border-slate-50 focus:border-yellow-400 outline-none pb-6 transition-all text-slate-900 placeholder:text-slate-100"
              value={formData.title.es}
              onChange={(e) => handleTitleChange(e.target.value)}
              required
            />
            <textarea 
              placeholder="Cuerpo de la noticia..."
              className="w-full p-10 bg-white rounded-[3rem] border border-slate-200 outline-none font-serif text-lg min-h-[500px] text-slate-800 leading-loose"
              value={formData.content.es}
              onChange={(e) => setFormData({...formData, content: {...formData.content, es: e.target.value}})}
            />
          </div>
        </section>

        {/* Inglés */}
        <section className="space-y-8 bg-slate-50/50 p-10 rounded-[3rem] border border-slate-200/50">
          <div className="flex items-center gap-3 mb-4">
            <span className="w-4 h-4 bg-blue-600 rounded-full"></span>
            <span className="text-xs font-black uppercase tracking-widest text-slate-400">English</span>
          </div>
          <div className="space-y-6">
            <input 
              placeholder="News headline..."
              className="w-full text-4xl font-black bg-transparent border-b-2 border-slate-50 focus:border-blue-600 outline-none pb-6 transition-all text-slate-900 placeholder:text-slate-100"
              value={formData.title.en}
              onChange={(e) => setFormData({...formData, title: {...formData.title, en: e.target.value}})}
            />
            <textarea 
              placeholder="News body content..."
              className="w-full p-10 bg-white rounded-[3rem] border border-slate-200 outline-none font-serif text-lg min-h-[500px] text-slate-800 leading-loose"
              value={formData.content.en}
              onChange={(e) => setFormData({...formData, content: {...formData.content, en: e.target.value}})}
            />
          </div>
        </section>
      </div>

      {/* FECHA Y SLUG */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-8 bg-slate-950 p-12 rounded-[4rem] text-white shadow-2xl">
        <div className="space-y-4">
          <label className="text-[10px] font-black uppercase text-slate-500 tracking-[0.3em] ml-2">Slug English (SEO)</label>
          <input 
            className="w-full bg-slate-900 border border-slate-800 rounded-[1.5rem] p-5 text-sm font-mono text-blue-400 outline-none focus:border-blue-500/50 transition-colors" 
            value={formData.slug_en} 
            onChange={e => setFormData({...formData, slug_en: slugify(e.target.value)})} 
          />
        </div>
        <div className="space-y-4">
          <label className="text-[10px] font-black uppercase text-slate-500 tracking-[0.3em] ml-2">Fecha de Publicación</label>
          <input 
            type="date" 
            className="w-full bg-slate-900 border border-slate-800 rounded-[1.5rem] p-5 text-sm outline-none text-white focus:border-emerald-500/50 transition-colors [color-scheme:dark]" 
            value={formData.date} 
            onChange={e => setFormData({...formData, date: e.target.value})} 
          />
        </div>
      </section>

      {/* BOTÓN FLOTANTE */}
      <div className="fixed bottom-12 left-1/2 -translate-x-1/2 w-full max-w-lg px-8 z-[100]">
        <button 
          type="submit" 
          disabled={loading}
          className="w-full py-7 bg-emerald-500 text-white rounded-full font-black text-xl hover:bg-emerald-400 hover:scale-[1.02] transition-all shadow-[0_20px_50px_rgba(16,185,129,0.4)] active:scale-95 disabled:opacity-50 uppercase tracking-tighter"
        >
          {loading ? 'GUARDANDO CAMBIOS...' : (isEditing ? '💾 ACTUALIZAR NOTICIA' : '🚀 PUBLICAR NOTICIA')}
        </button>
      </div>
    </form>
  )
}