import { supabase } from '@/lib/supabase'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import Link from 'next/link'
import { randomUUID } from 'crypto'
import ProjectMaterialsEditor from '@/components/admin/ProjectMaterialsEditor'
import ProjectGalleryEditor from '@/components/admin/ProjectGalleryEditor'

/**
 * SERVER ACTION: CREAR PROYECTO
 */
async function createProjectAction(formData: FormData) {
  'use server'

  const newId = randomUUID();
  const pullZoneBase = process.env.PULL_ZONE_URL?.replace(/\/$/, '') || "https://lanzadera-digital.b-cdn.net"; 
  
  const createSlug = (text: string) => 
    text.toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "") 
        .replace(/[^\w ]+/g, '') 
        .replace(/ +/g, '-') 
        .trim();

  const nombreEs = formData.get('project_name_es')?.toString()?.trim() || "Nuevo Proyecto";
  const nombreEn = formData.get('project_name_en')?.toString()?.trim() || "";
  const slug = createSlug(nombreEs);

  /**
   * NORMALIZADOR DEFINITIVO
   * Asegura que el dominio b-cdn.net siempre vaya seguido de /camar.es/
   */
  const normalizeUrl = (inputSrc: string) => {
    if (!inputSrc) return "";
    
    // 1. Si es solo el nombre del archivo, construir ruta completa
    let url = inputSrc.startsWith('http') 
      ? inputSrc 
      : `${pullZoneBase}/camar.es/Proyectos/${slug}/${inputSrc}`;

    // 2. Si es una URL de nuestra CDN, forzar que incluya /camar.es/
    if (url.includes('lanzadera-digital.b-cdn.net')) {
      if (!url.includes('/camar.es/')) {
        // Inyectamos camar.es justo después del dominio
        url = url.replace('lanzadera-digital.b-cdn.net/', 'lanzadera-digital.b-cdn.net/camar.es/');
      }
    }

    // 3. Limpieza de posibles dobles barras o duplicados de carpeta de cliente
    url = url.replace(/\/camar\.es\/camar\.es\//g, '/camar.es/');
    // Eliminar posibles dobles barras accidentales (excepto después de http:)
    url = url.replace(/([^:]\/)\/+/g, "$1");

    return url;
  };

  // 1. PROCESAR GALERÍA
  let galleryArray = [];
  const galleryInput = formData.get('gallery_json')?.toString();
  if (galleryInput) {
    try { 
      const parsed = JSON.parse(galleryInput);
      galleryArray = parsed.map((img: any) => ({
        type: 'image',
        src: normalizeUrl(typeof img === 'string' ? img : img.src)
      }));
    } catch { galleryArray = []; }
  }

  // 2. PROCESAR IMAGEN DE FONDO
  const bgImg = normalizeUrl(formData.get('bg_image')?.toString() || "");

  // 3. PROCESAR IMAGEN PRINCIPAL
  const mainImgInput = formData.get('main_image')?.toString();
  const mainImg = normalizeUrl(mainImgInput || (galleryArray.length > 0 ? galleryArray[0].src : ""));

  const projectPage = {
    folder: slug,
    gallery: galleryArray,
    bg_image: bgImg,
    materials: JSON.parse(formData.get('materials')?.toString() || "[]"),
    pageTitle: {
      es: formData.get('title_es')?.toString() || nombreEs,
      en: formData.get('title_en')?.toString() || nombreEn
    },
    sobreElProyecto: {
      es: formData.get('sobreElProyecto_es')?.toString() || "",
      en: formData.get('sobreElProyecto_en')?.toString() || ""
    }
  };

  try {
    const { error } = await supabase.from('proyectos').insert({
        id: newId,
        project_name: { es: nombreEs, en: nombreEn },
        slug: slug,
        project_location: { 
          es: formData.get('project_location_es')?.toString() || "", 
          en: formData.get('project_location_en')?.toString() || "" 
        },
        type: formData.get('type') ? [formData.get('type')?.toString()] : ["Otro"],
        project_page: projectPage,
        main_image: mainImg
    });

    if (error) throw error;
  } catch (error) {
    console.error("Error en Supabase:", error);
    return;
  }

  revalidatePath('/admin/projects');
  redirect(`/admin/projects/${slug}`);
}

export default function NewProjectPage() {
  const PROJECT_TYPES = ["Hoteles", "Vivienda Privada", "Proyectos Singulares", "Fuentes", "Proyectos Religiosos", "Otro"];

  const bunnyConfig = {
    storageZone: process.env.BUNNY_STORAGE_ZONE,
    accessKey: process.env.BUNNY_ACCESS_KEY,
    storageUrl: process.env.BUNNY_BASE_URL,
    pullZone: process.env.PULL_ZONE_URL
  };

  return (
    <div className="max-w-6xl mx-auto p-6 pb-20">
      <form action={createProjectAction}>
        <div className="flex justify-between items-end mb-10">
          <div>
            <Link href="/admin/projects" className="text-slate-400 text-xs font-black uppercase mb-2 block hover:text-slate-900 transition">
              ← Cancelar
            </Link>
            <h1 className="text-5xl font-black text-slate-900 uppercase tracking-tighter leading-none italic">
              Nuevo Proyecto
            </h1>
          </div>
          <button type="submit" className="bg-emerald-500 text-white px-10 py-5 rounded-2xl font-black hover:bg-emerald-600 transition shadow-xl uppercase text-[10px] tracking-widest active:scale-95">
            Publicar Proyecto
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          <div className="lg:col-span-8 space-y-10">
            <section className="bg-slate-900 rounded-[3rem] p-10 text-white shadow-xl">
              <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-8 flex items-center gap-2 italic">
                <span className="w-2 h-2 bg-emerald-500 rounded-full"></span> Identidad Principal
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <label className="text-[10px] font-black uppercase text-slate-500 ml-2">Nombre Comercial</label>
                  <input required name="project_name_es" type="text" placeholder="Ej: Villa Oasis" className="w-full p-4 bg-slate-800 rounded-2xl border-none font-bold text-white focus:ring-2 focus:ring-emerald-500 outline-none" />
                  <input name="project_name_en" type="text" placeholder="Ej: Oasis Villa" className="w-full p-4 bg-slate-800 rounded-2xl border-none font-bold text-emerald-400 focus:ring-2 focus:ring-emerald-500 outline-none" />
                </div>
                <div className="space-y-4">
                  <label className="text-[10px] font-black uppercase text-slate-500 ml-2">Ubicación</label>
                  <input name="project_location_es" type="text" placeholder="Marbella, España" className="w-full p-4 bg-slate-800 rounded-2xl border-none font-bold text-white focus:ring-2 focus:ring-emerald-500 outline-none" />
                  <input name="project_location_en" type="text" placeholder="Marbella, Spain" className="w-full p-4 bg-slate-800 rounded-2xl border-none font-bold text-emerald-400 focus:ring-2 focus:ring-emerald-500 outline-none" />
                </div>
              </div>
            </section>

            <ProjectGalleryEditor 
              initialGallery={[]} 
              bunnyConfig={bunnyConfig}
            />

            <section className="bg-white rounded-[3rem] p-10 border border-slate-200 shadow-sm space-y-8">
              <h3 className="text-xs font-black uppercase text-slate-400 tracking-widest flex items-center gap-2 italic">
                <span className="w-2 h-2 bg-indigo-500 rounded-full"></span> Títulos y Detalles
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Título de Página</label>
                  <input name="title_es" type="text" placeholder="Título largo ES" className="w-full p-4 bg-slate-50 rounded-2xl border-none font-bold mb-2 focus:ring-2 focus:ring-slate-200 outline-none" />
                  <input name="title_en" type="text" placeholder="Long Title EN" className="w-full p-4 bg-indigo-50/50 rounded-2xl border-none font-bold text-indigo-900 focus:ring-2 focus:ring-indigo-100 outline-none" />
                </div>
                <div className="space-y-4">
                  <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Sobre el proyecto</label>
                  <textarea name="sobreElProyecto_es" rows={4} placeholder="Descripción..." className="w-full p-4 bg-slate-50 rounded-2xl border-none font-medium text-sm focus:ring-2 focus:ring-slate-200 outline-none resize-none" />
                  <textarea name="sobreElProyecto_en" rows={4} placeholder="Description..." className="w-full p-4 bg-indigo-50/50 rounded-2xl border-none font-medium text-sm text-indigo-900 focus:ring-2 focus:ring-indigo-100 outline-none resize-none" />
                </div>
              </div>
            </section>
          </div>

          <div className="lg:col-span-4 space-y-8">
            <ProjectMaterialsEditor initialMaterials={[]} />
            <section className="bg-slate-50 rounded-[2.5rem] p-8 border border-slate-200 shadow-inner">
              <h3 className="text-[10px] font-black uppercase text-slate-400 mb-6 tracking-widest">Categoría</h3>
              <select name="type" className="w-full bg-white border border-slate-200 rounded-xl p-4 font-bold text-sm shadow-sm outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer">
                {PROJECT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </section>
          </div>
        </div>
      </form>
    </div>
  )
}