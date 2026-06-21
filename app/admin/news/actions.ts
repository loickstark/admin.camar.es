'use server'

import { supabase } from '@/lib/supabase'
import { revalidatePath } from 'next/cache'
import { randomUUID } from 'crypto'
import { recordEdit } from '@/lib/app-meta'
import { triggerDeploy } from '@/lib/deploy-hook'
import { setFlash } from '@/lib/flash'
import { requireSession } from '@/lib/auth'

/**
 * CONFIGURACIÓN DE BUNNY CDN
 * Asegúrate de que estas variables estén en tu .env.local
 */
const STORAGE_ZONE = process.env.BUNNY_STORAGE_ZONE_NAME; // Ejemplo: 'lanzadera-digital'
const ACCESS_KEY = process.env.BUNNY_STORAGE_API_KEY;    // La 'Storage API Key'
const STORAGE_ENDPOINT = 'storage.bunnycdn.com';        // O 'ny.storage...' según tu región

/**
 * FUNCIÓN PARA BORRAR FÍSICAMENTE EN LA CDN
 */
async function deleteFileFromBunny(folderPath: string, fileName: string) {
  if (!folderPath || !fileName) return;

  // Limpiamos la ruta para evitar dobles barras
  const cleanPath = folderPath.replace(/^\/|\/$/g, '');
  const url = `https://${STORAGE_ENDPOINT}/${STORAGE_ZONE}/${cleanPath}/${fileName}`;

  try {
    const response = await fetch(url, {
      method: 'DELETE',
      headers: { 
        AccessKey: ACCESS_KEY as string 
      }
    });

    if (response.ok) {
      console.log(` Eliminado de CDN: ${fileName}`);
    } else {
      console.error(` Fallo borrado CDN (${response.status}): ${fileName}`);
    }
  } catch (error) {
    console.error(" Error conexión Bunny API:", error);
  }
}

/**
 * ACCIÓN PARA BORRAR UNA IMAGEN SUELTA (Se llama desde el botón de eliminar del formulario)
 */
export async function deleteCDNFileAction(folder: string, fileName: string) {
  await requireSession();
  try {
    await deleteFileFromBunny(folder, fileName);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * ACCIÓN PARA CREAR/EDITAR NOTICIA
 */
export async function upsertNewsAction(formData: FormData) {
  await requireSession();
  try {
    const data = Object.fromEntries(formData) as Record<string, string>;

    const deepParse = (val: any) => {
      if (typeof val !== 'string') return val;
      try {
        const p = JSON.parse(val);
        return typeof p === 'string' ? JSON.parse(p) : p;
      } catch { return val; }
    };

    const title = deepParse(data.title);
    const excerpt = deepParse(data.excerpt);
    const content = deepParse(data.content);
    const gallery = deepParse(data.gallery) || [];

    const isUpdate = Boolean(data.id && data.id !== '');

    if (isUpdate) {
      await supabase`
        UPDATE noticias SET 
          title = ${title},
          slug_es = ${data.slug_es},
          slug_en = ${data.slug_en},
          folder_custom = ${data.folder_custom},
          date = ${data.date},
          excerpt = ${excerpt},
          content = ${content},
          main_image = ${data.main_image},
          gallery = ${gallery}
        WHERE id = ${data.id}
      `;
    } else {
      const newId = randomUUID();
      await supabase`
        INSERT INTO noticias (
          id, title, slug_es, slug_en, folder_custom, date, excerpt, content, main_image, gallery
        ) VALUES (
          ${newId}, ${title}, ${data.slug_es}, ${data.slug_en}, ${data.folder_custom}, 
          ${data.date}, ${excerpt}, ${content}, ${data.main_image}, ${gallery}
        )
      `;
    }

    await recordEdit();
    await triggerDeploy();
    await setFlash(isUpdate ? 'news-updated' : 'news-created');
    revalidatePath('/admin/news');
    return { success: true };
  } catch (error: any) {
    console.error(" Error DB Noticias:", error.message);
    return { success: false, error: error.message };
  }
}

/**
 * ACCIÓN PARA ELIMINAR TODA LA NOTICIA Y SUS ARCHIVOS
 */
export async function deleteNewsAction(formData: FormData) {
  await requireSession();
  try {
    const id = formData.get('id') as string;
    
    // Obtenemos datos para saber qué borrar en la CDN
    const rows = await supabase`SELECT folder_custom, main_image, gallery FROM noticias WHERE id = ${id}`;
    if (rows.length === 0) throw new Error("No existe la noticia");
    const news = rows[0];

    const folder = `camar.es/Noticias/${news.folder_custom}`;

    // Borrar imagen principal
    if (news.main_image) await deleteFileFromBunny(folder, news.main_image);

    // Borrar galería
    const gallery = typeof news.gallery === 'string' ? JSON.parse(news.gallery) : news.gallery;
    if (Array.isArray(gallery)) {
      for (const img of gallery) {
        const fileName = typeof img === 'string' ? img : img.src;
        await deleteFileFromBunny(folder, fileName);
      }
    }

    // Borrar de DB
    await supabase`DELETE FROM noticias WHERE id = ${id}`;

    await triggerDeploy();
    revalidatePath('/admin/news');
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}