import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import DeleteNewsButton from './DeleteNewsButton' // Importamos el nuevo componente

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
    <div className="space-y-6 max-w-7xl mx-auto p-4">
      {/* HEADER */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-black text-slate-900 uppercase tracking-tighter italic">Noticias</h1>
          <p className="text-slate-500 text-sm font-medium">Panel de gestión de prensa y actualidad</p>
        </div>
        <Link 
          href="/admin/news/new" 
          className="bg-emerald-600 text-white px-6 py-3 rounded-2xl font-black hover:bg-emerald-700 transition shadow-lg flex items-center gap-2 uppercase text-[10px] tracking-widest active:scale-95"
        >
          <span className="text-lg">+</span> Nueva Noticia
        </Link>
      </div>

      {/* TABLA */}
      <div className="bg-white rounded-[2rem] border border-slate-200 overflow-hidden shadow-sm">
        <table className="w-full text-left border-collapse">
          <thead className="bg-slate-50/50 border-b border-slate-200 text-slate-400 text-[10px] uppercase font-black tracking-widest">
            <tr>
              <th className="p-6 w-24 text-center">Preview</th>
              <th className="p-6">Contenido</th>
              <th className="p-6 text-center">Publicación</th>
              <th className="p-6 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {news.length === 0 ? (
              <tr>
                <td colSpan={4} className="p-20 text-center">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">No hay noticias publicadas todavía</span>
                </td>
              </tr>
            ) : (
              news.map((item: any) => (
                <tr key={item.id} className="hover:bg-slate-50/50 transition group">
                  <td className="p-6">
                    <div className="w-16 h-16 rounded-2xl bg-slate-100 overflow-hidden border border-slate-200 relative shadow-sm group-hover:scale-105 transition-transform">
                      {item.main_image ? (
                        <img 
                          src={`${PULL_ZONE}${item.folder_custom || item.slug_es}/${item.main_image}`} 
                          className="w-full h-full object-cover"
                          alt=""
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-[8px] text-slate-300 font-bold uppercase p-1 text-center bg-slate-50">
                          N/A
                        </div>
                      )}
                    </div>
                  </td>

                  <td className="p-6">
                    <div className="flex flex-col">
                      <span className="font-bold text-slate-900 text-lg leading-tight group-hover:text-emerald-600 transition-colors">
                        {item.title?.es || item.title}
                      </span>
                      <span className="text-[10px] font-mono text-slate-400 mt-1 uppercase tracking-tighter">
                        URL: /{item.slug_es}
                      </span>
                    </div>
                  </td>

                  <td className="p-6 text-center">
                    <span className="inline-block px-3 py-1 bg-slate-100 rounded-full text-slate-600 text-[10px] font-black uppercase">
                      {formatDate(item.date)}
                    </span>
                  </td>

                  <td className="p-6 text-right">
                    <div className="flex justify-end gap-2 items-center">
                      <Link 
                        href={`/admin/news/${item.slug_es}`}
                        className="bg-slate-900 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-600 transition-all shadow-sm"
                      >
                        Editar
                      </Link>

                      {/* Usamos el componente cliente que maneja la confirmación */}
                      <DeleteNewsButton slug={item.slug_es} />
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