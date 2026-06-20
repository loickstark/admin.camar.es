import { supabase } from '@/lib/supabase'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import Link from 'next/link'
import { randomUUID } from 'crypto'
import { recordEdit } from '@/lib/app-meta'
import { triggerDeploy } from '@/lib/deploy-hook'
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
    const projectName = { es: nombreEs, en: nombreEn };
    const projectLocation = {
      es: formData.get('project_location_es')?.toString() || "",
      en: formData.get('project_location_en')?.toString() || "",
    };
    const typeValue = formData.get('type')?.toString();
    const typeArr: string[] = typeValue ? [typeValue] : ["Otro"];

    await supabase`
      INSERT INTO proyectos (id, project_name, slug, project_location, type, project_page, main_image)
      VALUES (
        ${newId},
        ${JSON.stringify(projectName)},
        ${slug},
        ${JSON.stringify(projectLocation)},
        ${typeArr},
        ${JSON.stringify(projectPage)},
        ${mainImg}
      )
    `;
  } catch (error) {
    console.error("Error creando proyecto:", error);
    return;
  }

  await recordEdit();
  await triggerDeploy();
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
    <div className="mx-auto max-w-6xl pb-20">
      <form action={createProjectAction}>
        <div className="mb-10 flex items-end justify-between">
          <div>
            <Link href="/admin/projects" className="link-hover mb-2 block text-[10px] uppercase tracking-widest text-dynamicBlack/50">
              ← Cancelar
            </Link>
            <h1 className="font-vollkorn text-5xl uppercase leading-none tracking-tight text-dynamicBlack">
              Nuevo proyecto
            </h1>
          </div>
          <button type="submit" className="btn-primary">
            Publicar proyecto
          </button>
        </div>

        <div className="grid grid-cols-1 gap-10 lg:grid-cols-12">
          <div className="space-y-10 lg:col-span-8">
            <section className="rounded-xl border border-secondaryBlack bg-dynamicBlack p-10 text-baliPearl">
              <h3 className="mb-8 flex items-center gap-2 font-vollkorn text-sm uppercase tracking-widest text-baliPearl/60">
                <span className="h-2 w-2 rounded-full bg-bubonicBrown"></span> Identidad principal
              </h3>
              <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
                <div className="space-y-3">
                  <label className="block text-[10px] uppercase tracking-wide text-baliPearl/50">Nombre </label>
                  <input required name="project_name_es" type="text" placeholder="Ej: Villa Oasis" className="w-full rounded-md border border-secondaryBlack bg-secondaryBlack/50 p-3 text-baliPearl outline-none default-transition placeholder:text-baliPearl/30 focus:border-bubonicBrown" />
                  <input name="project_name_en" type="text" placeholder="Ej: Oasis Villa" className="w-full rounded-md border border-secondaryBlack bg-secondaryBlack/50 p-3 text-baliPearl outline-none default-transition placeholder:text-baliPearl/30 focus:border-bubonicBrown" />
                </div>
                <div className="space-y-3">
                  <label className="block text-[10px] uppercase tracking-wide text-baliPearl/50">Ubicación</label>
                  <input name="project_location_es" type="text" placeholder="Marbella, España" className="w-full rounded-md border border-secondaryBlack bg-secondaryBlack/50 p-3 text-baliPearl outline-none default-transition placeholder:text-baliPearl/30 focus:border-bubonicBrown" />
                  <input name="project_location_en" type="text" placeholder="Marbella, Spain" className="w-full rounded-md border border-secondaryBlack bg-secondaryBlack/50 p-3 text-baliPearl outline-none default-transition placeholder:text-baliPearl/30 focus:border-bubonicBrown" />
                </div>
              </div>
            </section>

            <ProjectGalleryEditor
              initialGallery={[]}
              initialMain=""
              initialBg=""
              bunnyConfig={bunnyConfig}
            />

            <section className="card space-y-6">
              <h3 className="flex items-center gap-2 font-vollkorn text-sm uppercase tracking-widest text-dynamicBlack/60">
                <span className="h-2 w-2 rounded-full bg-bubonicBrown"></span> Títulos y detalles
              </h3>
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <div className="space-y-3">
                  <label className="label">Título de página</label>
                  <input name="title_es" type="text" placeholder="Título largo ES" className="input" />
                  <input name="title_en" type="text" placeholder="Long title EN" className="input" />
                </div>
                <div className="space-y-3">
                  <label className="label">Sobre el proyecto</label>
                  <textarea name="sobreElProyecto_es" rows={4} placeholder="Descripción..." className="input resize-none" />
                  <textarea name="sobreElProyecto_en" rows={4} placeholder="Description..." className="input resize-none" />
                </div>
              </div>
            </section>
          </div>

          <div className="space-y-8 lg:col-span-4">
            <ProjectMaterialsEditor initialMaterials={[]} />
            <section className="card">
              <h3 className="mb-6 text-xs uppercase tracking-widest text-dynamicBlack/50">Categoría</h3>
              <select name="type" className="input cursor-pointer">
                {PROJECT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </section>
          </div>
        </div>
      </form>
    </div>
  )
}