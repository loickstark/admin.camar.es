import { supabase } from '@/lib/supabase'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { recordEdit } from '@/lib/app-meta'
import { setFlash } from '@/lib/flash'
import { triggerDeploy } from '@/lib/deploy-hook'
import { MATERIAL_TYPE_ES, getMaterialTypeEn } from '@/lib/material-types'
import { requireSession } from '@/lib/auth'
import CreateMaterialForm from '@/components/forms/CreateMaterialForm'

/**
 * ACCIÓN DE SERVIDOR: Crea el material y sube la imagen a Bunny.net
 */
async function createMaterialAction(formData: FormData) {
  'use server'

  await requireSession()

  try {
    const name = formData.get('material_name') as string
    const file = formData.get('image') as File
    const selectedType = formData.get('type_es') as string // Obtenemos el valor del dropdown

    // La imagen es obligatoria al crear un material
    if (!file || file.size === 0) {
      throw new Error("La imagen del material es obligatoria");
    }

    let imageUrl = ''

    // 1. SUBIDA A BUNNY.NET (Storage API)
    if (file && file.size > 0) {
      const sanitizedName = name
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim()
        .replace(/\s+/g, '-');
        
      const fileName = `${Date.now()}-${sanitizedName}.webp`;
      const storageUrl = `${process.env.BUNNY_BASE_URL}/${process.env.BUNNY_STORAGE_ZONE}/camar.es/Materiales/${fileName}`;

      const response = await fetch(storageUrl, {
        method: 'PUT',
        headers: {
          'AccessKey': process.env.BUNNY_ACCESS_KEY!,
          'Content-Type': 'application/octet-stream',
        },
        body: Buffer.from(await file.arrayBuffer()),
        // @ts-ignore
        duplex: 'half', 
      });

      if (!response.ok) {
        throw new Error(`Error al subir imagen a Bunny: ${response.status}`);
      }

      imageUrl = `${process.env.PULL_ZONE_URL}/camar.es/Materiales/${fileName}`;
    }

    // 2. PREPARACIÓN DE JSON PARA NEON
    const location = JSON.stringify({
      es: formData.get('location_es') || "",
      en: formData.get('location_en') || ""
    });

    const description = JSON.stringify({
      es: formData.get('description_es') || "",
      en: formData.get('description_en') || ""
    });

    // Guardamos el tipo capitalizado (ES) + su traducción (EN) desde el mapa interno
    const materialType = JSON.stringify({
      es: selectedType,
      en: getMaterialTypeEn(selectedType)
    });

    // Usos seleccionados (columna text[]) — siempre lowercase
    const useArray = (formData.get('use') ? JSON.parse(formData.get('use') as string) : [])
      .map((u: string) => String(u).toLowerCase());

    // 3. INSERCIÓN EN NEON (SQL)
    await supabase`
      INSERT INTO materiales (
        id,
        material_name,
        location,
        description,
        material_type,
        image_url,
        use,
        created_at
      ) VALUES (
        ${crypto.randomUUID()},
        ${name},
        ${location},
        ${description},
        ${materialType},
        ${imageUrl},
        ${useArray},
        NOW()
      )
    `;

    console.log(" Material creado correctamente.");

  } catch (error: any) {
    console.error(" ERROR EN ACCIÓN:", error.message);
    throw new Error(error.message); 
  }

  await recordEdit();
  await triggerDeploy();
  await setFlash('material-created');
  revalidatePath('/admin/materials');
  revalidatePath('/');
  redirect('/admin/materials');
}

export default async function NewMaterialPage() {

  // Nombres existentes para validar duplicados/parecidos en tiempo real
  let existingNames: string[] = [];
  try {
    const rows = await supabase`SELECT material_name FROM materiales WHERE material_name IS NOT NULL`;
    existingNames = rows.map((r: any) => r.material_name).filter(Boolean);
  } catch (err) {
    console.error("No se pudieron cargar los nombres de materiales:", err);
  }

  return <CreateMaterialForm action={createMaterialAction} materialTypes={MATERIAL_TYPE_ES} existingNames={existingNames} />
}