'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { upsertProjectAction, deleteCDNFileAction } from '@/app/admin/projects/actions'
import ImageUploader from '../ImageUploader'

export default function ProjectForm({ initialData }: { initialData?: any }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  
  const PULL_ZONE = "https://lanzadera-digital.b-cdn.net/camar.es/Proyectos/"

  /**
   * Función de parseo ultra-segura. 
   */
  const parseSafe = (data: any, fallback: any) => {
    if (!data) return fallback;
    if (typeof data === 'object' && !Array.isArray(data)) return data;
    try {
      let parsed = typeof data === 'string' ? JSON.parse(data) : data;
      // Manejar doble serialización si ocurre
      if (typeof parsed === 'string') parsed = JSON.parse(parsed);
      return parsed || fallback;
    } catch (e) {
      console.warn("Error parseando campo, usando fallback", e);
      return fallback;
    }
  };

  // Inicialización del estado
  const [formData, setFormData] = useState({
    id: initialData?.id || '',
    slug_es: initialData?.slug_es || '',
    slug_en: initialData?.slug_en || '',
    projectName: parseSafe(initialData?.projectName, { es: '', en: '' }),
    projectLocation: parseSafe(initialData?.projectLocation, { es: '', en: '' }),
    type: parseSafe(initialData?.type, []), 
    mainImage: initialData?.mainImage || '',
    bgImage: initialData?.bgImage || '',
    projectPage: parseSafe(initialData?.projectPage, {
      filtro: "Vivienda Privada",
      pageTitle: { es: '', en: '' },
      pageDescription: { es: '', en: '' },
      gallery: [],
      sobreElProyecto: { es: '', en: '' },
      projectDetails: [
        { label: { es: "Categoría", en: "Category" }, value: { es: "", en: "" } },
        { label: { es: "Fecha", en: "Date" }, value: { es: "", en: "" } },
        { label: { es: "País", en: "Country" }, value: { es: "", en: "" } }
      ],
      masInformacion: [],
      materials: []
    })
  })

  // Sincronización con el servidor
  useEffect(() => {
    if (initialData && initialData.id === formData.id) {
      setFormData(prev => ({
        ...prev,
        projectName: parseSafe(initialData.projectName, prev.projectName),
        projectLocation: parseSafe(initialData.projectLocation, prev.projectLocation),
        projectPage: parseSafe(initialData.projectPage, prev.projectPage),
        mainImage: initialData.mainImage || prev.mainImage,
        bgImage: initialData.bgImage || prev.bgImage,
        slug_es: initialData.slug_es || prev.slug_es,
        slug_en: initialData.slug_en || prev.slug_en
      }));
    }
  }, [initialData]);

  const removeGalleryImage = async (idx: number, fileName: string) => {
    if (!confirm("¿Eliminar de la nube?")) return;
    const result = await deleteCDNFileAction("Proyectos", fileName);
    if (result.success) {
      const newGallery = formData.projectPage.gallery.filter((_: any, i: number) => i !== idx)
      setFormData({
        ...formData,
        projectPage: { ...formData.projectPage, gallery: newGallery }
      })
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const data = new FormData()
      data.append('id', formData.id)
      data.append('slug_es', formData.slug_es)
      data.append('slug_en', formData.slug_en)
      data.append('mainImage', formData.mainImage)
      data.append('bgImage', formData.bgImage)
      
      data.append('projectName', JSON.stringify(formData.projectName))
      data.append('projectLocation', JSON.stringify(formData.projectLocation))
      data.append('type', JSON.stringify(formData.type))
      data.append('projectPage', JSON.stringify(formData.projectPage))

      const result = await upsertProjectAction(data)
      
      if (result?.success) {
        router.refresh();
        alert("¡Cambios guardados con éxito!");
      } else {
        alert("Error al guardar: " + result?.error)
      }
    } catch (err) {
      console.error(err);
      alert("Error crítico al guardar");
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-12 pb-32 text-slate-900">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
        {/* SECCIÓN CASTELLANO */}
        <div className="bg-emerald-50/30 p-8 rounded-[3rem] space-y-6 border border-emerald-100">
          <h3 className="text-emerald-700 font-black uppercase tracking-tighter">🇪🇸 Castellano</h3>
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-emerald-600 uppercase ml-2">Nombre del Proyecto</label>
            <input 
              className="w-full text-3xl font-black bg-white p-4 rounded-2xl border-b-4 border-emerald-200 outline-none focus:border-emerald-500 shadow-sm"
              value={formData.projectName?.es || ''}
              onChange={e => setFormData({...formData, projectName: {...formData.projectName, es: e.target.value}})}
              required
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-emerald-600 uppercase ml-2">Ubicación</label>
            <input 
              className="w-full text-xl font-bold bg-white p-4 rounded-2xl border-b-4 border-emerald-100 outline-none focus:border-emerald-500 shadow-sm"
              value={formData.projectLocation?.es || ''}
              onChange={e => setFormData({...formData, projectLocation: {...formData.projectLocation, es: e.target.value}})}
            />
          </div>
        </div>

        {/* SECCIÓN INGLÉS */}
        <div className="bg-blue-50/30 p-8 rounded-[3rem] space-y-6 border border-blue-100">
          <h3 className="text-blue-700 font-black uppercase tracking-tighter">🇬🇧 English</h3>
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-blue-600 uppercase ml-2">Project Name</label>
            <input 
              className="w-full text-3xl font-black bg-white p-4 rounded-2xl border-b-4 border-blue-200 outline-none focus:border-blue-500 shadow-sm"
              value={formData.projectName?.en || ''}
              onChange={e => setFormData({...formData, projectName: {...formData.projectName, en: e.target.value}})}
              required
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-blue-600 uppercase ml-2">Location</label>
            <input 
              className="w-full text-xl font-bold bg-white p-4 rounded-2xl border-b-4 border-blue-100 outline-none focus:border-blue-500 shadow-sm"
              value={formData.projectLocation?.en || ''}
              onChange={e => setFormData({...formData, projectLocation: {...formData.projectLocation, en: e.target.value}})}
            />
          </div>
        </div>
      </div>

      <section className="bg-white p-8 rounded-[3rem] border border-slate-200">
        <h3 className="text-lg font-black mb-6 uppercase tracking-tighter text-slate-400">📸 Galería de Imágenes</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-8 gap-4">
          {formData.projectPage.gallery.map((img: any, i: number) => (
            <div key={i} className="group relative aspect-square rounded-2xl overflow-hidden border border-slate-100 shadow-inner">
              <img src={`${PULL_ZONE}${img.src}`} className="w-full h-full object-cover" alt={`Galería ${i}`} />
              <button 
                type="button" 
                onClick={() => removeGalleryImage(i, img.src)} 
                className="absolute inset-0 bg-red-600/80 text-white opacity-0 group-hover:opacity-100 flex items-center justify-center text-[10px] font-black transition-opacity"
              >
                QUITAR
              </button>
            </div>
          ))}
          <div className="aspect-square">
            <ImageUploader 
              folder="Proyectos" 
              onUploadSuccess={(name) => setFormData({
                ...formData, 
                projectPage: {
                  ...formData.projectPage, 
                  gallery: [...formData.projectPage.gallery, {type:'image', src:name}]
                }
              })} 
            />
          </div>
        </div>
      </section>

      <div className="fixed bottom-10 left-1/2 -translate-x-1/2 w-full max-w-md px-6 z-50">
        <button 
          type="submit" 
          disabled={loading}
          className="w-full py-6 bg-emerald-500 text-white rounded-full font-black text-2xl shadow-2xl hover:bg-emerald-600 hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:hover:scale-100"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-5 h-5 border-4 border-white border-t-transparent rounded-full animate-spin"></span>
              GUARDANDO...
            </span>
          ) : 'GUARDAR CAMBIOS'}
        </button>
      </div>
    </form>
  )
}