'use server'

import { supabase } from '@/lib/supabase'
import { revalidatePath } from 'next/cache'

/**
 * Función de borrado robusta. 
 * Extrae el path exacto para que el timestamp coincida con el archivo real.
 */
async function deleteFromBunny(oldFullUrl: string) {
  const baseUrl = process.env.BUNNY_BASE_URL?.replace(/\/$/, '');
  const storageZone = process.env.BUNNY_STORAGE_ZONE;
  const accessKey = process.env.BUNNY_ACCESS_KEY;

  if (!baseUrl || !storageZone || !accessKey || !oldFullUrl) return;

  try {
    // 1. Extraemos el pathname (ej: /camar.es/Materiales/177780...-foto.png)
    // Esto garantiza que el número (timestamp) sea el exacto de la foto vieja.
    const urlObj = new URL(oldFullUrl);
    const cleanPath = urlObj.pathname;

    const storageUrl = `${baseUrl}/${storageZone}${cleanPath}`;

    console.log(`🗑️ Solicitando borrado de archivo antiguo: ${cleanPath}`);

    const res = await fetch(storageUrl, {
      method: 'DELETE',
      headers: { 
        'AccessKey': accessKey,
        'accept': '*/*' 
      },
    });

    if (res.ok) {
      console.log(`✅ CDN: Archivo anterior eliminado con éxito.`);
    } else {
      const errorMsg = await res.text();
      console.error(`⚠️ CDN: No se pudo borrar (${res.status}): ${errorMsg}`);
    }
  } catch (err) {
    console.error("❌ CDN: Error de red al intentar borrar:", err);
  }
}

export async function upsertMaterialAction(formData: FormData) {
  const id = formData.get('id')?.toString();
  const material_name = formData.get('material_name')?.toString() || '';
  const main_image = formData.get('main_image')?.toString() || '';
  
  let material_type, location, description, use;
  try {
    material_type = JSON.parse(formData.get('material_type') as string || '{"es":"","en":""}');
    location = JSON.parse(formData.get('location') as string || '{"es":"","en":""}');
    description = JSON.parse(formData.get('description') as string || '{"es":"","en":""}');
    use = JSON.parse(formData.get('use') as string || '[]');
  } catch (e) {
    return { success: false, error: "Error en el formato de los datos JSON" };
  }

  try {
    if (id && id !== "") {
      // --- PASO 1: CAPTURAR LA REFERENCIA DE LA IMAGEN VIEJA ---
      // Lo hacemos antes de actualizar para no perder el timestamp original.
      const { data: currentData } = await supabase
        .from('materiales')
        .select('main_image')
        .eq('id', id)
        .single();

      const oldImageUrl = currentData?.main_image;

      // --- PASO 2: ACTUALIZAR LA BASE DE DATOS ---
      const { error: updateError } = await supabase
        .from('materiales')
        .update({
          material_name,
          material_type,
          location,
          description,
          use,
          main_image
        })
        .eq('id', id);

      if (updateError) throw updateError;

      // --- PASO 3: BORRADO DEL CDN ---
      // Solo si la imagen ha cambiado realmente (identificado por el cambio de nombre/timestamp)
      if (oldImageUrl && oldImageUrl !== main_image) {
        // MUY IMPORTANTE: El await asegura que la Server Action no muera antes del borrado.
        await deleteFromBunny(oldImageUrl);
      }

    } else {
      // INSERT (Creación de nuevo material)
      const { error: insertError } = await supabase
        .from('materiales')
        .insert([{
          material_name,
          material_type,
          location,
          description,
          use,
          main_image
        }]);
      
      if (insertError) throw insertError;
    }

    // Revalidación para limpiar la caché de Next.js
    revalidatePath('/admin/materials');
    return { success: true };

  } catch (error: any) {
    console.error("❌ Error en upsertMaterialAction:", error.message);
    return { success: false, error: error.message };
  }
}