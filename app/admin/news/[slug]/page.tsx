import { supabase } from '@/lib/supabase'
import NewsForm from '@/components/forms/NewsForm'
import { notFound } from 'next/navigation'
import Link from 'next/link'

// Definimos los tipos para Next.js 15
interface Props {
  params: Promise<{ slug: string }>
}

export default async function EditNewsPage({ params }: Props) {
  // 1. Esperamos a que los params se resuelvan (Requisito de Next.js 15)
  const resolvedParams = await params;
  const slug = resolvedParams.slug;

  // 2. Buscamos la noticia usando la sintaxis de postgres.js
  let noticia;
  try {
    const data = await supabase`
      SELECT * FROM noticias 
      WHERE slug_es = ${slug} 
      LIMIT 1
    `;
    noticia = data[0]; // postgres.js devuelve un array, tomamos el primer elemento
  } catch (err: any) {
    console.error("Error al obtener la noticia:", err.message);
    return notFound();
  }

  // 3. Si no existe la noticia, mandamos al 404
  if (!noticia) {
    return notFound();
  }

  return (
    <div className="max-w-6xl mx-auto py-10 px-6">
      {/* Cabecera del Editor */}
      <div className="mb-10 flex justify-between items-end">
        <div className="space-y-2">
          <Link 
            href="/admin/news" 
            className="group flex items-center gap-2 text-emerald-600 text-[10px] font-black uppercase tracking-widest hover:text-emerald-700 transition-colors"
          >
            <span className="text-lg group-hover:-translate-x-1 transition-transform">←</span> 
            Volver al listado
          </Link>
          <h1 className="text-5xl font-black text-slate-900 tracking-tight uppercase leading-none">
            Editar Noticia
          </h1>
          <p className="text-slate-400 font-medium italic">
            Editando: <span className="text-slate-600">"{noticia.title?.es}"</span>
          </p>
        </div>

        <div className="hidden md:flex flex-col items-end gap-2">
          <div className="bg-emerald-500 text-white px-4 py-1.5 rounded-full text-[10px] font-black border border-emerald-600 shadow-xl shadow-emerald-200 animate-pulse">
            SISTEMA CONECTADO
          </div>
          <span className="text-[10px] font-mono text-slate-300">ID: {noticia.id}</span>
        </div>
      </div>

      {/* El Formulario con los datos cargados */}
      <div className="bg-white p-6 md:p-12 rounded-[3.5rem] border border-slate-200 shadow-2xl shadow-slate-200/60 relative overflow-hidden">
        {/* Decoración visual de fondo */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-slate-50 rounded-bl-full -z-10 opacity-50"></div>
        
        {/* 
            CORRECCIÓN CLAVE: 
            Pasamos 'noticia.slug_es' como 'existingFolder'. 
            Esto asegura que el NewsForm sepa que debe borrar/subir archivos 
            en la carpeta ya existente en el CDN, ignorando cambios en el título.
        */}
        <NewsForm 
          initialData={noticia} 
          isEditing={true} 
          existingFolder={noticia.slug_es} 
        />
      </div>
      
      <div className="mt-8 text-center">
        <p className="text-slate-400 text-xs">
          Cualquier cambio realizado se sincronizará con la CDN de Bunny.net y la DB de Supabase.
        </p>
      </div>
    </div>
  )
}