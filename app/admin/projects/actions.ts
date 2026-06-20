"use server"

import { supabase } from "@/lib/supabase"
import { revalidatePath } from "next/cache"

// Configuración de la CDN
const PULL_ZONE_URL = "https://lanzadera-digital.b-cdn.net";
const BASE_FOLDER = "camar.es/Proyectos";

/**
 * Función auxiliar para formatear la URL de la imagen.
 * Si ya es una URL completa, la mantiene. Si es un nombre de archivo, construye la ruta de la CDN.
 */
function formatCDNUrl(fileName: string | undefined, slug: string): string {
  if (!fileName || fileName.trim() === "" || fileName.startsWith('http')) {
    return fileName || "";
  }
  // Construye la ruta: Dominio + Carpeta Base + Carpeta del Proyecto (Slug) + Archivo
  return `${PULL_ZONE_URL}/${BASE_FOLDER}/${slug}/${fileName}`;
}

export async function upsertProjectAction(formData: FormData) {
  const id = formData.get('id')?.toString();
  const slug_es = formData.get('slug_es')?.toString() || '';
  
  // Capturamos los 3 pilares de la galería
  const main_image = formData.get('mainImage')?.toString() || '';
  const bg_image = formData.get('bgImage')?.toString() || '';
  const gallery_json = JSON.parse(formData.get('gallery_json') as string || '[]');

  try {
    // 1. Obtener datos viejos para limpieza de CDN (Copiado de Materiales)
    let oldMain = '', oldBg = '';
    if (id) {
      const { data } = await supabase.from('proyectos').select('mainImage, bgImage').eq('id', id).single();
      oldMain = data?.mainImage;
      oldBg = data?.bgImage;
    }

    // 2. Ejecutar el Upsert
    const projectData = {
      slug_es,
      projectName: JSON.parse(formData.get('projectName') as string),
      mainImage: main_image, // Mantenemos tus nombres de columna
      bgImage: bg_image,
      gallery_json: gallery_json
    };

    if (id && id !== "") {
      const { error } = await supabase.from('proyectos').update(projectData).eq('id', id);
      if (error) throw error;
    } else {
      const { error } = await supabase.from('proyectos').insert([projectData]);
      if (error) throw error;
    }

    // 3. Limpieza de CDN (La lógica "crítica" de Materiales)
    if (oldMain && oldMain !== main_image) await deleteFromBunny(oldMain);
    if (oldBg && oldBg !== bg_image) await deleteFromBunny(oldBg);

    revalidatePath('/admin/projects');
    return { success: true };

  } catch (error: any) {
    console.error("❌ Error:", error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Acción para eliminar archivos físicamente de Bunny CDN.
 */
export async function deleteCDNFileAction(folder: string, fileName: string) {
  const STORAGE_ZONE_NAME = process.env.BUNNY_STORAGE_ZONE_NAME;
  const ACCESS_KEY = process.env.BUNNY_STORAGE_API_KEY; // Verifica que el nombre coincida con tu .env
  const STORAGE_ENDPOINT = "storage.bunnycdn.com";

  if (!STORAGE_ZONE_NAME || !ACCESS_KEY) {
    return { success: false, error: "Configuración de CDN incompleta" };
  }

  try {
    // Aseguramos que la carpeta incluya la ruta base si no viene del cliente
    const fullFolder = folder.startsWith('camar.es') ? folder : `${BASE_FOLDER}/${folder}`;
    const url = `https://${STORAGE_ENDPOINT}/${STORAGE_ZONE_NAME}/${fullFolder}/${fileName}`;

    const response = await fetch(url, {
      method: 'DELETE',
      headers: { 'AccessKey': ACCESS_KEY },
    });

    return { success: response.ok };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}