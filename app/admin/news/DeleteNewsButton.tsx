'use client'

import { deleteNewsAction } from './actions'

export default function DeleteNewsButton({ slug }: { slug: string }) {
  // Manejamos la confirmación antes de ejecutar la Server Action
  const clientAction = async (formData: FormData) => {
    const si = confirm("¿Estás seguro de eliminar esta noticia? Esta acción no se puede deshacer.");
    if (si) {
      await deleteNewsAction(formData);
    }
  };

  return (
    <form action={clientAction}>
      <input type="hidden" name="slug" value={slug} />
      <button 
        type="submit"
        className="text-slate-400 hover:text-red-600 hover:bg-red-50 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
      >
        Eliminar
      </button>
    </form>
  );
}