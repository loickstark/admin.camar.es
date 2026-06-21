// /app/admin/materials/page.tsx
import { supabase } from '@/lib/supabase'
import { revalidatePath } from 'next/cache'
import Link from 'next/link'
import MaterialsList, { type MaterialItem } from '@/components/admin/MaterialsList'
import FlashNotice from '@/components/admin/FlashNotice'
import { triggerDeploy } from '@/lib/deploy-hook'
import { requireSession } from '@/lib/auth'

/**
 * ACCIÓN PARA ELIMINAR MATERIAL (Server Action)
 */
async function deleteMaterialAction(formData: FormData) {
  'use server'

  await requireSession();

  const id = formData.get('id') as string;
  if (!id) return;

  try {
    // 1. OBTENER LA URL DE LA IMAGEN ANTES DE BORRAR EL REGISTRO
    // Esto es opcional, pero recomendable para borrar el archivo de Bunny
    const [material] = await supabase`
      SELECT image_url FROM materiales WHERE id = ${id}
    `;

    if (material?.image_url) {
      // Extraemos el nombre del archivo de la URL
      const fileName = material.image_url.split('/').pop();
      const storageUrl = `${process.env.BUNNY_BASE_URL}/${process.env.BUNNY_STORAGE_ZONE}/camar.es/Materiales/${fileName}`;

      // 2. BORRAR DE BUNNY.NET
      await fetch(storageUrl, {
        method: 'DELETE',
        headers: {
          'AccessKey': process.env.BUNNY_ACCESS_KEY!,
        },
      });
      console.log(" Imagen borrada de Bunny");
    }

    // 3. BORRAR DE NEON (SQL PURO)
    await supabase`
      DELETE FROM materiales 
      WHERE id = ${id}
    `;

    console.log(" Registro borrado de la base de datos");

  } catch (error: any) {
    console.error(" Error eliminando material:", error.message);
    return;
  }

  await triggerDeploy();
  // Revalidamos la ruta para que desaparezca de la lista
  revalidatePath('/admin/materials');
}

export default async function MaterialsListPage() {
  // 1. Obtenemos los materiales ordenados por nombre usando SQL puro (Neon)
  let materiales;
  try {
    materiales = await supabase`
      SELECT * FROM materiales 
      ORDER BY material_name ASC
    `;
  } catch (err) {
    return (
      <div className="alert-error m-6 font-mono">
        <h2 className="mb-2 font-vollkorn uppercase">Error de conexión (Neon)</h2>
        <p className="text-sm">No se pudo conectar a la base de datos o la tabla no existe.</p>
      </div>
    );
  }

  const safeParse = (data: any) => {
    if (!data || typeof data !== 'string') return data;
    try {
      return JSON.parse(data);
    } catch (e) {
      return data; // Si no es JSON, devuelve el texto tal cual
    }
  };

  const CDN_BASE = "https://lanzadera-digital.b-cdn.net/camar.es/Materiales";

  // Construimos el modelo de vista (serializable) para el listado con buscador
  const items: MaterialItem[] = (materiales || []).map((m: any) => {
    const materialType = safeParse(m.material_type);
    const location = safeParse(m.location);
    const description = safeParse(m.description);

    let baseSlug = m.slug?.replace(/^\//, '').replace(/-hq$/, '');
    if (!baseSlug && m.material_name) {
      baseSlug = m.material_name.toLowerCase().trim().replace(/\s+/g, '-');
    }

    const thumb = m.image_url || m.main_image || m.image || `${CDN_BASE}/${baseSlug}-hq.webp`;
    const nombre = m.material_name || "Sin nombre";
    const tipo = materialType?.es || (typeof materialType === 'string' ? materialType : "Piedra Natural");
    const pais = location?.es || (typeof location === 'string' ? location : "Origen no especificado");
    const desc = description?.es || (typeof description === 'string' ? description : "Sin descripción disponible.");
    const uses: string[] = Array.isArray(m.use) ? m.use : [];

    const searchText = [nombre, tipo, pais, desc, ...uses]
      .join(' ')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();

    return {
      id: m.id,
      nombre,
      tipo,
      pais,
      desc,
      thumb,
      uses,
      editHref: `/admin/materials/${m.slug?.replace(/^\//, '') || m.id}`,
      searchText,
    };
  });

  return (
    <div className="space-y-8">
      <FlashNotice
        messages={{
          'material-created': 'Material creado con éxito',
          'material-updated': 'Material actualizado con éxito',
        }}
      />

      {/* HEADER DE SECCIÓN */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-vollkorn text-4xl uppercase tracking-tight text-dynamicBlack">
            Materiales
          </h1>
          <p className="mt-2 text-dynamicBlack/60">
            Catálogo de piedra natural
          </p>
        </div>
        <Link href="/admin/materials/new" className="btn-primary">
          + Añadir material
        </Link>
      </div>

      <MaterialsList items={items} deleteAction={deleteMaterialAction} />
    </div>
  );
}