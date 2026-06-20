// lib/bunny-actions.ts
'use server'

/**
 * Sube un archivo a Bunny.net organizándolo por carpetas de proyecto
 */
export async function uploadFileToBunny(
  file: File, 
  folder: 'Noticias' | 'Materiales' | 'Proyectos', 
  projectSlug?: string
) {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    // Limpiar el nombre del archivo para evitar errores en URL
    const safeFileName = file.name.replace(/\s+/g, '-').toLowerCase();
    
    // Si hay slug, creamos subcarpeta: Proyectos/escaleras-geodude/archivo.jpg
    // Si no, va a la carpeta raíz: Proyectos/archivo.jpg
    const path = projectSlug ? `${folder}/${projectSlug}` : folder;
    
    const storageUrl = `${process.env.BUNNY_BASE_URL}/${process.env.BUNNY_STORAGE_ZONE}/camar.es/${path}/${safeFileName}`;

    const res = await fetch(storageUrl, {
      method: 'PUT',
      headers: {
        'AccessKey': process.env.BUNNY_ACCESS_KEY!,
        'Content-Type': 'application/octet-stream',
      },
      body: buffer,
    });

    if (res.ok) {
      // URL Pública para usar en el frontend (Pull Zone)
      const publicUrl = `https://${process.env.BUNNY_PULL_ZONE}/camar.es/${path}/${safeFileName}`;
      return { success: true, url: publicUrl };
    }

    return { success: false, status: res.status };
  } catch (error) {
    console.error("❌ Error subiendo a Bunny:", error);
    return { success: false, error };
  }
}

/**
 * Borra un archivo de Bunny.net de forma segura
 * @param folder La subcarpeta dentro de cammar.es/ (Noticias, Materiales, Proyectos)
 * @param fileName El nombre del archivo con extensión
 */
export async function deleteFileFromBunny(
  folder: 'Noticias' | 'Materiales' | 'Proyectos', 
  fileName: string,
  projectSlug?: string // Añadimos el slug opcional
) {
  if (!fileName) return { success: false, error: 'No filename' };

  // Limpiamos el fileName por si viene con una ruta completa (solo queremos el nombre final)
  const cleanFileName = fileName.split('/').pop();

  // Construimos el path exactamente igual que en uploadFileToBunny
  const path = projectSlug ? `${folder}/${projectSlug}` : folder;
  
  const storageUrl = `${process.env.BUNNY_BASE_URL}/${process.env.BUNNY_STORAGE_ZONE}/camar.es/${path}/${cleanFileName}`;

  try {
    const res = await fetch(storageUrl, {
      method: 'DELETE',
      headers: {
        'AccessKey': process.env.BUNNY_ACCESS_KEY!,
      },
    });

    if (res.ok) {
      console.log(`✅ Borrado: camar.es/${path}/${cleanFileName}`);
      return { success: true };
    }
    
    const errorData = await res.json().catch(() => ({}));
    console.error("❌ Error Bunny status:", res.status, errorData);
    return { success: false, status: res.status };
  } catch (error) {
    console.error("❌ Error en fetch Bunny:", error);
    return { success: false, error };
  }
}