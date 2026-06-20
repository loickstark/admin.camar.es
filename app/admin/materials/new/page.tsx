import { supabase } from '@/lib/supabase'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import Link from 'next/link'
import ImagePicker from '@/components/admin/ImagePicker'

/**
 * ACCIÓN DE SERVIDOR: Crea el material y sube la imagen a Bunny.net
 */
async function createMaterialAction(formData: FormData) {
  'use server'

  try {
    const name = formData.get('material_name') as string
    const file = formData.get('image') as File
    const selectedType = formData.get('type_es') as string // Obtenemos el valor del dropdown
    
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

    // Guardamos el tipo seleccionado del dropdown
    const materialType = JSON.stringify({
      es: selectedType || "OTRO",
      en: selectedType || "OTHER" // Puedes añadir un mapeo si necesitas traducción exacta
    });

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
        ${[]}, 
        NOW()
      )
    `;

    console.log("✅ Material creado correctamente.");

  } catch (error: any) {
    console.error("❌ ERROR EN ACCIÓN:", error.message);
    throw new Error(error.message); 
  }

  revalidatePath('/admin/materials');
  revalidatePath('/');
  redirect('/admin/materials');
}

export default function NewMaterialPage() {
  
  // Opciones basadas en la imagen de referencia
  const MATERIAL_TYPES = [
    "MÁRMOL", "GRANITO", "CUARCITA", "ÓNIX", "TRAVERTINO", 
    "CALIZA", "MINERAL", "ALABASTRO", "ARENISCA", "PÓRFIDO"
  ];

  return (
    <form action={createMaterialAction} className="max-w-6xl mx-auto p-6 pb-20">
      
      {/* HEADER */}
      <div className="flex justify-between items-end mb-10">
        <div>
          <Link href="/admin/materials" className="text-slate-400 text-[10px] font-black uppercase hover:text-slate-900 mb-2 block transition-colors">
            ← Volver al Catálogo
          </Link>
          <h1 className="text-5xl font-black text-slate-900 uppercase tracking-tighter italic">
            Nuevo Material
          </h1>
        </div>
        <button type="submit" className="bg-emerald-500 text-white px-10 py-5 rounded-2xl font-black hover:bg-emerald-600 transition shadow-xl uppercase text-[10px] tracking-widest active:scale-95">
          Crear Material
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* COLUMNA IZQUIERDA: IMAGEN */}
        <div className="lg:col-span-4">
          <section className="bg-white rounded-[3rem] p-8 border border-slate-200 shadow-sm space-y-6 text-center">
            <h3 className="text-xs font-black uppercase text-slate-400 tracking-widest">Imagen del Material</h3>
            <ImagePicker />
            <p className="text-[9px] text-slate-400 font-medium italic">
              Formatos: WebP / JPG (Máx 1MB).
            </p>
          </section>
        </div>

        {/* COLUMNA DERECHA: DATOS */}
        <div className="lg:col-span-8 space-y-8">
          
          <section className="bg-white rounded-[3rem] p-10 border border-slate-200 shadow-sm space-y-8">
            <h3 className="text-xs font-black uppercase text-slate-400 tracking-widest italic">1. Identidad y Clasificación</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Nombre Comercial</label>
                <input name="material_name" required type="text" placeholder="Ej: Blanco Macael" className="w-full p-4 bg-slate-50 rounded-2xl border-none font-bold focus:ring-2 focus:ring-slate-900" />
              </div>

              {/* DROPDOWN DE TIPOS INTEGRADO */}
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Tipo de Material</label>
                <select 
                  name="type_es" 
                  required
                  className="w-full p-4 bg-slate-50 rounded-2xl border-none font-bold focus:ring-2 focus:ring-slate-900 appearance-none cursor-pointer"
                >
                  <option value="" disabled selected>Selecciona un tipo...</option>
                  {MATERIAL_TYPES.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Origen (ES)</label>
                <input name="location_es" type="text" placeholder="Almería, España" className="w-full p-4 bg-slate-50 rounded-2xl border-none font-bold focus:ring-2 focus:ring-slate-900" />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-indigo-400 ml-2">Origin (EN)</label>
                <input name="location_en" type="text" placeholder="Spain" className="w-full p-4 bg-indigo-50/30 rounded-2xl border-none font-bold text-indigo-900 focus:ring-2 focus:ring-indigo-500" />
              </div>
            </div>
          </section>

          <section className="bg-white rounded-[3rem] p-10 border border-slate-200 shadow-sm space-y-8">
            <h3 className="text-xs font-black uppercase text-slate-400 tracking-widest italic">2. Descripción Bilingüe</h3>
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Descripción (ES)</label>
                <textarea name="description_es" rows={3} className="w-full p-5 bg-slate-50 rounded-[2rem] border-none font-medium focus:ring-2 focus:ring-slate-900 leading-relaxed" />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-indigo-400 ml-2">Description (EN)</label>
                <textarea name="description_en" rows={3} className="w-full p-5 bg-indigo-50/30 rounded-[2rem] border-none font-medium text-indigo-900 focus:ring-2 focus:ring-indigo-500 leading-relaxed" />
              </div>
            </div>
          </section>
        </div>

      </div>
    </form>
  )
}