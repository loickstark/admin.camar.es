import { supabase } from '@/lib/supabase'
import { notFound, redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import Link from 'next/link'
import ProjectMaterialsEditor from '@/components/admin/ProjectMaterialsEditor'
import ProjectGalleryEditor from '@/components/admin/ProjectGalleryEditor'
import { DeleteProjectButton } from '@/components/admin/DeleteProjectButton'

/**
 * SERVER ACTION: ACTUALIZAR PROYECTO
 * Corregido para reconstruir URLs absolutas de BunnyCDN y limpiar datos vacíos.
 */
async function updateProjectAction(formData: FormData) {
  'use server'

  const id = formData.get('id')?.toString();
  if (!id) return;

  // 1. OBTENER DATOS ACTUALES Y CONFIGURACIÓN
  const currentRes = await supabase`SELECT * FROM proyectos WHERE id = ${id}`;
  const current = currentRes[0];
  if (!current) return;

  const pullZone = process.env.PULL_ZONE_URL; // Ej: https://lanzadera-digital.b-cdn.net/camar.es
  const fixedSlug = current.slug;

  // 2. DETECTAR CARPETA DEL PROYECTO
  let folder = "";
  const pgOld = typeof current.project_page === 'string' ? JSON.parse(current.project_page) : (current.project_page || {});
  
  if (pgOld.folder) {
    folder = pgOld.folder;
  } else if (current.main_image) {
    const match = current.main_image.match(/Proyectos\/([^/]+)/);
    if (match) folder = match[1];
  }

  // 3. PROCESAR GALERÍA (RECONSTRUCCIÓN DE URLS)
  let galleryArray = [];
  const galleryInput = formData.get('gallery_json')?.toString();
  try { 
    const parsed = galleryInput ? JSON.parse(galleryInput) : [];
    galleryArray = parsed
      .filter((img: any) => img.src && img.src.trim() !== "")
      .map((img: any) => {
        // Si la URL no es absoluta (no empieza por http), le ponemos la ruta completa
        if (!img.src.startsWith('http')) {
          return {
            ...img,
            src: `${pullZone}/Proyectos/${folder}/${img.src}`
          };
        }
        return img;
      });
  } catch (e) { galleryArray = []; }

  // 4. RECONSTRUIR EL OBJETO PROJECT_PAGE (JSONB)
  const updatedProjectPage = {
    ...pgOld,
    folder: folder, // Aseguramos persistencia de la carpeta
    gallery: galleryArray,
    materials: JSON.parse(formData.get('materials')?.toString() || "[]"),
    pageTitle: {
      es: formData.get('title_es')?.toString() || "",
      en: formData.get('title_en')?.toString() || ""
    },
    sobreElProyecto: {
      es: formData.get('sobreElProyecto_es')?.toString() || "",
      en: formData.get('sobreElProyecto_en')?.toString() || ""
    }
  };

  // 5. EJECUTAR UPDATE EN POSTGRES
  try {
    const finalName = JSON.stringify({ 
      es: formData.get('project_name_es')?.toString() || "", 
      en: formData.get('project_name_en')?.toString() || "" 
    });
    const finalLocation = JSON.stringify({ 
      es: formData.get('project_location_es')?.toString() || "", 
      en: formData.get('project_location_en')?.toString() || "" 
    });

    // Procesar Main Image (reconstruir si es solo nombre)
    let finalMain = formData.get('main_image')?.toString() || (galleryArray.length > 0 ? galleryArray[0].src : current.main_image);
    if (finalMain && !finalMain.startsWith('http')) {
      finalMain = `${pullZone}/camar.es/Proyectos/${folder}/${finalMain}`;
    }

    await supabase`
      UPDATE proyectos SET
        project_name = ${finalName},
        project_location = ${finalLocation},
        project_page = ${JSON.stringify(updatedProjectPage)},
        main_image = ${finalMain},
        type = ${formData.get('type') ? [formData.get('type')] : (current.type || [])}
      WHERE id = ${id}
    `;
  } catch (error) {
    console.error("Error crítico en Update:", error);
    return;
  }

  revalidatePath('/admin/projects');
  revalidatePath(`/admin/projects/${fixedSlug}`);
  revalidatePath(`/proyectos/${fixedSlug}`);
  
  redirect(`/admin/projects/${fixedSlug}?updated=${Date.now()}`);
}

/**
 * SERVER ACTION: ELIMINAR PROYECTO
 */
async function deleteProjectAction(formData: FormData) {
  'use server'
  const id = formData.get('id')?.toString();
  if (!id) return;
  await supabase`DELETE FROM proyectos WHERE id = ${id}`;
  revalidatePath('/admin/projects');
  redirect('/admin/projects');
}

/**
 * PÁGINA DE EDICIÓN (SERVER COMPONENT)
 */
export default async function EditProjectPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug: rawSlug } = await params;
  const decodedSlug = decodeURIComponent(rawSlug);

  const res = await supabase`
    SELECT * FROM proyectos 
    WHERE slug = ${decodedSlug} 
    LIMIT 1
  `;
  const p = res[0];

  if (!p) return notFound();

  const parseJSON = (data: any, fallback: any) => {
    if (!data) return fallback;
    if (typeof data === 'object' && data !== null) return data;
    try { return JSON.parse(data); } catch { return fallback; }
  };

  const nameData = parseJSON(p.project_name, { es: "", en: "" });
  const locData = parseJSON(p.project_location, { es: "", en: "" });
  const pg = parseJSON(p.project_page, {});
  
  const gallery = Array.isArray(pg.gallery) ? pg.gallery : [];
  const materials = Array.isArray(pg.materials) ? pg.materials : [];
  const pageTitle = pg.pageTitle || { es: "", en: "" };
  const sobreElProyecto = pg.sobreElProyecto || { es: "", en: "" };

  // Detección de carpeta para el componente de Galería
  let detectedFolder = pg.folder || "";
  if (!detectedFolder && gallery.length > 0) {
    const firstImg = gallery[0]?.src || "";
    const folderMatch = firstImg.match(/Proyectos\/([^/]+)/);
    if (folderMatch) detectedFolder = folderMatch[1];
  }

  const bunnyConfig = {
    storageZone: process.env.BUNNY_STORAGE_ZONE,
    accessKey: process.env.BUNNY_ACCESS_KEY,
    storageUrl: process.env.BUNNY_BASE_URL,
    pullZone: process.env.PULL_ZONE_URL
  };

  const PROJECT_TYPES = ["Hoteles", "Vivienda Privada", "Proyectos Singulares", "Fuentes", "Proyectos Religiosos", "Otro"];

  return (
    <div className="max-w-6xl mx-auto p-6 pb-20">
      <form action={updateProjectAction}>
        <input type="hidden" name="id" value={p.id} />
        
        <div className="flex justify-between items-end mb-10">
          <div className="space-y-2">
            <Link href="/admin/projects" className="group flex items-center gap-2 text-slate-400 text-[10px] font-black uppercase tracking-widest hover:text-slate-900 transition-colors">
              <span className="text-lg group-hover:-translate-x-1 transition-transform">←</span> Volver al listado
            </Link>
            <h1 className="text-5xl font-black text-slate-900 uppercase tracking-tighter leading-none italic">
              {nameData.es || "Sin Nombre"}
            </h1>
          </div>
          <button type="submit" className="bg-emerald-500 text-white px-10 py-5 rounded-2xl font-black hover:bg-emerald-600 transition shadow-xl uppercase text-[10px] tracking-widest active:scale-95">
            💾 Guardar Cambios
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          <div className="lg:col-span-8 space-y-10">
            
            {/* IDENTIDAD */}
            <section className="bg-slate-900 rounded-[3rem] p-10 text-white shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-bl-full pointer-events-none"></div>
              <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-8 flex items-center gap-2 italic">
                <span className="w-2 h-2 bg-emerald-500 rounded-full"></span> Identidad Principal
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <label className="text-[10px] font-black uppercase text-slate-500 ml-2 tracking-widest">Nombre Comercial</label>
                  <input name="project_name_es" type="text" defaultValue={nameData.es} className="w-full p-4 bg-slate-800 rounded-2xl border-none font-bold text-white mb-2 focus:ring-2 focus:ring-emerald-500 outline-none" />
                  <input name="project_name_en" type="text" defaultValue={nameData.en} className="w-full p-4 bg-slate-800 rounded-2xl border-none font-bold text-emerald-400 focus:ring-2 focus:ring-emerald-500 outline-none" />
                </div>
                <div className="space-y-4">
                  <label className="text-[10px] font-black uppercase text-slate-500 ml-2 tracking-widest">Ubicación</label>
                  <input name="project_location_es" type="text" defaultValue={locData.es} className="w-full p-4 bg-slate-800 rounded-2xl border-none font-bold text-white mb-2 focus:ring-2 focus:ring-emerald-500 outline-none" />
                  <input name="project_location_en" type="text" defaultValue={locData.en} className="w-full p-4 bg-slate-800 rounded-2xl border-none font-bold text-emerald-400 focus:ring-2 focus:ring-emerald-500 outline-none" />
                </div>
              </div>
            </section>

            {/* GALERÍA DINÁMICA */}
            <ProjectGalleryEditor 
              initialGallery={gallery} 
              initialMain={p.main_image} 
              initialBg={pg.bg_image || ""}
              bunnyConfig={bunnyConfig}
              projectName={nameData.es}
              existingFolder={detectedFolder} 
            />

            {/* TEXTOS Y SEO */}
            <section className="bg-white rounded-[3rem] p-10 border border-slate-200 shadow-sm space-y-8">
              <h3 className="text-xs font-black uppercase text-slate-400 tracking-widest flex items-center gap-2 italic">
                <span className="w-2 h-2 bg-indigo-500 rounded-full"></span> Títulos y Descripción
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <label className="text-[10px] font-black uppercase text-slate-400 ml-2 tracking-widest">Título de Página (H1)</label>
                  <input name="title_es" type="text" defaultValue={pageTitle.es} className="w-full p-4 bg-slate-50 rounded-2xl border-none font-bold mb-2 focus:ring-2 focus:ring-slate-900 outline-none" />
                  <input name="title_en" type="text" defaultValue={pageTitle.en} className="w-full p-4 bg-indigo-50/50 rounded-2xl border-none font-bold text-indigo-900 focus:ring-2 focus:ring-indigo-500 outline-none" />
                </div>
                <div className="space-y-4">
                  <label className="text-[10px] font-black uppercase text-slate-400 ml-2 tracking-widest">Sobre el proyecto</label>
                  <textarea name="sobreElProyecto_es" rows={4} defaultValue={sobreElProyecto.es} className="w-full p-4 bg-slate-50 rounded-2xl border-none font-medium text-sm focus:ring-2 focus:ring-slate-900 resize-none outline-none" />
                  <textarea name="sobreElProyecto_en" rows={4} defaultValue={sobreElProyecto.en} className="w-full p-4 bg-indigo-50/50 rounded-2xl border-none font-medium text-sm text-indigo-900 focus:ring-2 focus:ring-indigo-500 resize-none outline-none" />
                </div>
              </div>
            </section>
          </div>

          {/* LATERAL */}
          <div className="lg:col-span-4 space-y-8">
            <ProjectMaterialsEditor initialMaterials={materials} />

            <section className="bg-slate-50 rounded-[2.5rem] p-8 border border-slate-200 shadow-inner">
              <h3 className="text-[10px] font-black uppercase text-slate-400 mb-6 tracking-widest flex items-center gap-2">
                ⚙️ Ajustes Técnicos
              </h3>
              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-500 uppercase ml-1">Tipo de Proyecto</label>
                  <select 
                    name="type" 
                    defaultValue={Array.isArray(p.type) ? p.type[0] : (p.type || "")} 
                    className="w-full bg-white border border-slate-200 rounded-xl p-3 font-bold text-sm shadow-sm outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    {PROJECT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div className="pt-4 border-t border-slate-200 text-slate-400 space-y-1 font-mono text-[9px] break-all">
                  <p>DATABASE ID: {p.id}</p>
                  <p>SLUG: {p.slug}</p>
                </div>
              </div>
            </section>
          </div>
        </div>
      </form>

      {/* ZONA DE ELIMINACIÓN */}
      <div className="mt-16 pt-10 border-t border-slate-100 flex flex-col items-center">
        <DeleteProjectButton 
          id={p.id} 
          projectName={nameData.es || "este proyecto"} 
          deleteAction={deleteProjectAction} 
        />
      </div>
    </div>
  )
}