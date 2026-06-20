import NewsForm from '@/components/forms/NewsForm'
import Link from 'next/link'

export default function CreateNewsPage() {
  return (
    <div className="max-w-6xl mx-auto py-10 px-6">
      
      {/* Cabecera del Creador */}
      <div className="mb-10 flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div className="space-y-2">
          <Link 
            href="/admin/news" 
            className="group flex items-center gap-2 text-emerald-600 text-[10px] font-black uppercase tracking-widest hover:text-emerald-700 transition-colors"
          >
            <span className="text-lg group-hover:-translate-x-1 transition-transform">←</span> 
            Volver al listado
          </Link>
          <h1 className="text-5xl font-black text-slate-900 tracking-tight uppercase leading-none">
            Nueva Noticia
          </h1>
          <p className="text-slate-400 font-medium italic">
            Configurando una nueva entrada para el blog de <span className="text-slate-600 text-sm not-italic font-bold ml-1">CAMAR ALMERÍA</span>
          </p>
        </div>

        <div className="flex flex-col items-end gap-2">
          <div className="bg-slate-900 text-white px-5 py-2 rounded-full text-[10px] font-black border border-slate-800 shadow-xl shadow-slate-200 uppercase tracking-widest">
            Borrador Nuevo
          </div>
          <span className="text-[10px] font-mono text-slate-300 italic">Esperando publicación...</span>
        </div>
      </div>

      {/* 
          CONTENEDOR DEL FORMULARIO 
          isEditing={false} activa el auto-slug y auto-folder mientras escribes el título.
          El ImageUploader funcionará automáticamente apuntando a la carpeta generada.
      */}
      <div className="bg-white p-6 md:p-12 rounded-[3.5rem] border border-slate-200 shadow-2xl shadow-slate-200/60 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-slate-50 rounded-bl-full -z-10 opacity-50"></div>
        
        {/* Usamos el formulario robusto que ya gestiona la lógica de guardado */}
        <NewsForm isEditing={false} />
      </div>
      
      <div className="mt-8 text-center flex flex-col gap-1">
        <p className="text-slate-400 text-xs font-medium">
          Al publicar, el sistema generará automáticamente las URLs amigables y organizará los assets en la CDN.
        </p>
        <p className="text-slate-300 text-[10px] uppercase font-bold tracking-tighter">
          Conexión segura con Supabase Cloud & Bunny.net
        </p>
      </div>
    </div>
  )
}