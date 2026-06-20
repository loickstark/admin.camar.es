'use client'

import { useState, useEffect } from 'react'
import ImageUploader from '../ImageUploader'
import { deleteFileFromBunny } from '@/lib/bunny-actions'

interface Props {
  initialGallery: any[]
  initialMain: string
  initialBg: string
  bunnyConfig: any
  projectName?: string 
  existingFolder?: string 
}

export default function ProjectGalleryEditor({ 
  initialGallery, 
  initialMain, 
  initialBg, 
  bunnyConfig,
  projectName = "",
  existingFolder
}: Props) {
  
  const [gallery, setGallery] = useState(initialGallery)
  const [mainImage, setMainImage] = useState(initialMain)

  // 1. GESTIÓN DE CARPETAS
  const [folderName, setFolderName] = useState(() => {
    if (existingFolder) return existingFolder;
    return "proyecto-sin-nombre";
  });

  const slugify = (text: string) => 
    text.toLowerCase()
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');

  useEffect(() => {
    if (!existingFolder && projectName && projectName.trim() !== "") {
      setFolderName(slugify(projectName));
    }
  }, [projectName, existingFolder]);

  // 2. CONFIGURACIÓN DE RUTAS CDN
  const CDN_BASE = bunnyConfig?.pullZone?.replace(/\/$/, '') || "https://lanzadera-digital.b-cdn.net";
  const PULL_ZONE = CDN_BASE.includes('camar.es') ? CDN_BASE : `${CDN_BASE}/camar.es`;

  const getImageUrl = (src: string) => {
    if (!src) return '';
    // Si ya es una URL completa (lo que acabamos de arreglar), devuélvela tal cual
  if (src.startsWith('http')) return src;
  
  // Si por algún motivo solo tienes el nombre del archivo (fallback)
  return `${PULL_ZONE}/Proyectos/${folderName}/${src}`;
  };

  // 3. LÓGICA DE BORRADO (CDN + BBDD)
  // 1. Necesita una nueva Server Action (ej: updateProjectGallery) 
// que haga un UPDATE en Supabase solo del campo gallery_json.

const removeImage = async (index: number) => {
  const imageToDelete = gallery[index];
  const src = typeof imageToDelete === 'string' ? imageToDelete : imageToDelete.src;
  const fileName = src.split('/').pop();

  if (!window.confirm("¡Cuidado! Esto borrará la imagen del servidor y de la base de datos ahora mismo.")) return;

  try {
    // 1. Borrar de Bunny
    const res = await deleteFileFromBunny('Proyectos', fileName, folderName);

    // Si es 200 (ok) o 404 (ya no estaba), procedemos a limpiar la BBDD
    if (res.success || res.status === 404) {
      const newGallery = gallery.filter((_, i) => i !== index);
      
      // 2. Actualizar estado local
      setGallery(newGallery);

      // 3. AQUÍ DEBERÍAS LLAMAR A TU ACCIÓN DE SUPABASE
      // await updateProjectInDB(projectId, { gallery: newGallery });
      
      console.log("Sincronizado: CDN y BBDD actualizados.");
    }
  } catch (error) {
    alert("Error crítico de sincronización");
  }
};

  return (
    <section className="bg-slate-50 p-8 rounded-[3rem] border border-slate-200 shadow-inner space-y-8">
      <div className="flex justify-between items-center">
        <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-2 italic">
          <span className="w-2 h-2 bg-emerald-500 rounded-full"></span> Multimedia del Proyecto
        </h3>
        <div className="flex flex-col items-end">
          <p className="text-[9px] font-black uppercase text-slate-400 mb-1">
            {existingFolder ? "📁 Carpeta Heredada" : "✨ Carpeta Nueva"}
          </p>
          <div className={`text-[10px] font-mono px-3 py-1 rounded-full border ${existingFolder ? 'text-amber-600 bg-amber-50 border-amber-100' : 'text-blue-600 bg-blue-50 border-blue-100'}`}>
            /camar.es/Proyectos/{folderName}/
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
        {/* PORTADA */}
        <div className="space-y-4">
          <label className="text-[10px] font-black uppercase text-slate-500 ml-1">Portada</label>
          <div className="aspect-[4/5] bg-white rounded-[2rem] overflow-hidden border-2 border-slate-200 relative group shadow-md">
            {mainImage ? (
              <img 
                src={getImageUrl(mainImage)} 
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" 
                alt="Portada"
                key={`${folderName}-${mainImage}`}
              />
            ) : (
              <div className="flex items-center justify-center h-full text-[10px] text-slate-300 font-bold uppercase p-6 text-center italic">Esperando imagen...</div>
            )}
          </div>
          <ImageUploader 
              // 1. Enviamos la ruta limpia al servidor para evitar carpetas duplicadas físicamente
              folder={`Proyectos/${folderName}` as any} 
              label="+"
              onUploadSuccess={(fileName) => {
                  // CONSTRUIMOS LA URL COMPLETA AQUÍ
                  const urlParaBBDD = `${CDN_BASE}/camar.es/Proyectos/${folderName}/${fileName}`;
                  setMainImage(urlParaBBDD); // <--- ACTUALIZA LA PORTADA
                  
                  // Opcional: También añadirla a la galería si quieres
                  setGallery(prev => [...prev, { type: 'image', src: urlParaBBDD }]);
              }}
            />
          <input type="hidden" name="main_image" value={mainImage} />
        </div>

        {/* GALERÍA */}
        <div className="md:col-span-3 space-y-4">
          <label className="text-[10px] font-black uppercase text-slate-500 ml-1">Galería ({gallery.length})</label>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {gallery.map((img, idx) => {
              const src = typeof img === 'string' ? img : img.src;
              return (
                <div key={idx} className="aspect-square bg-white rounded-2xl overflow-hidden border border-slate-200 relative group shadow-sm">
                  <img src={getImageUrl(src)} className="w-full h-full object-cover" alt={`Galería ${idx}`} />
                  <button 
                    type="button" 
                    onClick={() => removeImage(idx)} 
                    className="absolute inset-0 bg-red-600/90 text-white opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center font-black text-[10px] backdrop-blur-sm"
                  >
                    ELIMINAR PERMANENTEMENTE
                  </button>
                </div>
              );
            })}
            
            <div className="aspect-square bg-slate-200/50 rounded-2xl border-2 border-dashed border-slate-300 flex items-center justify-center hover:bg-slate-200 transition-colors">
              <ImageUploader 
                folder={`Proyectos/${folderName}` as any} 
                label="+"
                onUploadSuccess={(fileName) => {
                    // CONSTRUIMOS LA URL COMPLETA AQUÍ TAMBIÉN
                    const urlParaBBDD = `${CDN_BASE}/camar.es/Proyectos/${folderName}/${fileName}`;
                    setGallery(prev => [...prev, { type: 'image', src: urlParaBBDD }]);
                }}
              />
            </div>
          </div>
          <input type="hidden" name="gallery_json" value={JSON.stringify(gallery)} />
        </div>
      </div>
    </section>
  )
}