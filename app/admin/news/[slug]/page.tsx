import { supabase } from '@/lib/supabase'
import NewsForm from '@/components/forms/NewsForm'
import { notFound } from 'next/navigation'

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
    <NewsForm
      initialData={noticia}
      isEditing={true}
      existingFolder={noticia.slug_es}
    />
  )
}
