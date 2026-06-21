// Constantes de proyectos.

// Taxonomía `type` (multi-select). Valor lowercase (como en BD) + etiqueta capitalizada para UI.
export interface ProjectType {
  value: string
  label: string
}

export const PROJECT_TYPES: ProjectType[] = [
  { value: 'cocinas', label: 'Cocinas' },
  { value: 'hogar', label: 'Hogar' },
  { value: 'suelos', label: 'Suelos' },
  { value: 'baños', label: 'Baños' },
  { value: 'empresas', label: 'Empresas' },
  { value: 'hoteles', label: 'Hoteles' },
  { value: 'singulares', label: 'Singulares' },
  { value: 'religiosos', label: 'Religiosos' },
  { value: 'fuentes', label: 'Fuentes' },
]

export const projectTypeLabel = (value: string) =>
  PROJECT_TYPES.find((t) => t.value === value)?.label ?? value

// Valor del filtro del front (categoría única). Tal cual se usa en el front.
export const PROJECT_FILTERS = [
  'Vivienda Privada',
  'Hotel',
  'Fuente',
  'Religioso',
  'Singular',
]
