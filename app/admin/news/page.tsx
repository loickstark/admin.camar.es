import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { DeleteProjectButton } from '@/components/admin/DeleteProjectButton'
import FlashNotice from '@/components/admin/FlashNotice'
import { deleteNewsAction } from './actions'

export const dynamic = 'force-dynamic';

const PULL_ZONE = "https://lanzadera-digital.b-cdn.net/camar.es/Noticias/"

export default async function NewsListPage() {
  const news = await supabase`
    SELECT * FROM noticias 
    ORDER BY date DESC
  `;

  const formatDate = (dateString: string) => {
    if (!dateString) return '---'
    return new Date(dateString).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    })
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <FlashNotice
        messages={{
          'news-created': 'Noticia creada con éxito',
          'news-updated': 'Noticia actualizada con éxito',
        }}
      />
      {/* HEADER */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-vollkorn text-4xl uppercase tracking-tight text-dynamicBlack">Noticias</h1>
          <p className="mt-2 text-sm text-dynamicBlack/60">Panel de gestión de prensa y actualidad</p>
        </div>
        <Link href="/admin/news/new" className="btn-primary">
          <span className="text-lg">+</span> Nueva noticia
        </Link>
      </div>

      {/* TABLA */}
      <div className="overflow-hidden rounded-xl border border-dynamicBlack/10 bg-white">
        <table className="w-full border-collapse text-left">
          <thead className="border-b border-dynamicBlack/10 bg-secondaryGray/50 text-xs uppercase tracking-widest text-dynamicBlack/50">
            <tr>
              <th className="w-24 p-6 text-center font-workSans font-normal">Preview</th>
              <th className="p-6 font-workSans font-normal">Contenido</th>
              <th className="p-6 text-center font-workSans font-normal">Publicación</th>
              <th className="p-6 text-right font-workSans font-normal">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-dynamicBlack/5">
            {news.length === 0 ? (
              <tr>
                <td colSpan={4} className="p-20 text-center">
                  <span className="text-xs uppercase tracking-widest text-dynamicBlack/40">No hay noticias publicadas todavía</span>
                </td>
              </tr>
            ) : (
              news.map((item: any) => (
                <tr key={item.id} className="group default-transition hover:bg-secondaryGray/30">
                  <td className="p-6">
                    <div className="relative h-16 w-16 overflow-hidden rounded-md border border-dynamicBlack/10 bg-secondaryGray">
                      {item.main_image ? (
                        <img
                          src={`${PULL_ZONE}${item.folder_custom || item.slug_es}/${item.main_image}`}
                          className="h-full w-full object-cover"
                          alt=""
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center p-1 text-center text-[8px] uppercase text-dynamicBlack/30">
                          N/A
                        </div>
                      )}
                    </div>
                  </td>

                  <td className="max-w-xs p-6">
                    <div className="flex min-w-0 flex-col">
                      <span className="line-clamp-1 font-vollkorn text-lg leading-tight text-dynamicBlack">
                        {item.title?.es || item.title}
                      </span>
                      <span className="mt-1 line-clamp-1 text-sm text-dynamicBlack/50">
                        {item.excerpt?.es || ''}
                      </span>
                    </div>
                  </td>

                  <td className="p-6 text-center">
                    <span className="whitespace-nowrap text-xs text-dynamicBlack/50">{formatDate(item.date)}</span>
                  </td>

                  <td className="p-6 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Link href={`/admin/news/${item.slug_es}`} className="btn-primary btn-sm">
                        Editar
                      </Link>

                      <DeleteProjectButton
                        id={item.id}
                        projectName={item.title?.es || 'esta noticia'}
                        deleteAction={deleteNewsAction}
                      />
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}