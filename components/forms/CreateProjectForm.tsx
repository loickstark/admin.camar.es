"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { upsertProjectAction } from "@/app/admin/projects/actions"

export function CreateProjectForm() {
  const [name, setName] = useState("")
  const [isCreating, setIsCreating] = useState(false)
  const router = useRouter()

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    
    const trimmedName = name.trim()
    if (!trimmedName || isCreating) return

    setIsCreating(true)

    try {
      // 1. Generamos un slug único añadiendo un timestamp
      // Esto asegura la compatibilidad óptima en servidores y evita conflictos de archivos
      const timestamp = Date.now()
      const baseSlug = trimmedName
        .toLowerCase()
        .trim()
        .normalize("NFD") // Elimina acentos
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+/g, '-')
        .replace(/[^\w-]/g, '') // Elimina caracteres especiales
      
      const uniqueSlug = `${baseSlug}-${timestamp}`
      
      // 2. Preparamos el FormData
      const data = new FormData()
      data.append('id', '') // Indica creación
      data.append('slug_es', uniqueSlug)
      data.append('slug_en', uniqueSlug)
      
      // Serializamos los objetos para que la Server Action los reciba correctamente
      data.append('projectName', JSON.stringify({ es: trimmedName, en: trimmedName }))
      data.append('projectLocation', JSON.stringify({ es: "", en: "" }))
      data.append('type', JSON.stringify([]))
      
      // Estructura completa de projectPage para evitar campos undefined en el editor
      data.append('projectPage', JSON.stringify({
        filtro: "Vivienda Privada",
        pageTitle: { es: "", en: "" },
        pageDescription: { es: "", en: "" },
        gallery: [],
        materials: [],
        sobreElProyecto: { es: "", en: "" },
        projectDetails: [
          { label: { es: "Categoría", en: "Category" }, value: { es: "", en: "" } },
          { label: { es: "Fecha", en: "Date" }, value: { es: "", en: "" } },
          { label: { es: "País", en: "Country" }, value: { es: "", en: "" } }
        ]
      }))

      // 3. Llamada a la acción unificada
      const result = await upsertProjectAction(data)

      if (result.success) {
        // Redirigimos al editor del nuevo proyecto usando el slug generado
        router.push(`/admin/projects/${uniqueSlug}`)
        router.refresh()
      } else {
        alert("Error al crear el proyecto: " + result.error)
      }
    } catch (err) {
      console.error("Client Error:", err)
      alert("Ocurrió un error inesperado al procesar el formulario.")
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <form onSubmit={handleCreate} className="space-y-4">
      <input
        type="text"
        placeholder="Nombre del Proyecto (ej: Casa Bosque)"
        className="w-full p-4 bg-slate-900 text-white rounded-2xl border-none focus:ring-2 focus:ring-emerald-500 font-bold placeholder:text-slate-500"
        value={name}
        onChange={(e) => setName(e.target.value)}
        disabled={isCreating}
        required
      />
      <button
        type="submit"
        disabled={isCreating || !name.trim()}
        className="w-full py-4 bg-emerald-500 text-white rounded-2xl font-black uppercase tracking-widest hover:bg-emerald-600 transition disabled:opacity-50 active:scale-[0.98] shadow-lg shadow-emerald-500/20"
      >
        {isCreating ? (
          <div className="flex items-center justify-center gap-2">
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            <span>Iniciando Editor...</span>
          </div>
        ) : (
          "Crear e ir al Editor"
        )}
      </button>
    </form>
  )
}