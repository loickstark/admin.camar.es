# Integración con el front — la base de datos como *source of truth*

Esta guía explica cómo el front público de **camar.es** debe leer el contenido
directamente de la base de datos que gestiona este panel de administración, en
lugar de mantener el contenido hardcodeado.

> **Idea clave:** el panel (este repo) **escribe**; el front **solo lee**. La
> base de datos (Neon Postgres) es la única fuente de verdad para noticias,
> proyectos y materiales. Las imágenes/vídeos viven en el CDN de Bunny.

---

## 1. Arquitectura

```
┌────────────────┐     escribe      ┌──────────────────┐     lee      ┌──────────────┐
│  Panel admin   │ ───────────────▶ │  Neon Postgres   │ ◀─────────── │  Front web   │
│ (este repo)    │                  │  (DATABASE_URL)  │              │ (camar.es)   │
└────────────────┘                  └──────────────────┘              └──────────────┘
        │                                                                     ▲
        │  sube/borra assets                                                  │ construye URLs
        ▼                                                                     │
┌──────────────────────────────────────────────────────────────────────────────┐
│  Bunny CDN — Storage Zone "lanzadera-digital"  →  Pull Zone lanzadera-digital.b-cdn.net │
│  Todo cuelga de la raíz   camar.es/...                                          │
└──────────────────────────────────────────────────────────────────────────────┘
```

- **Datos**: Neon Postgres, accesible con cualquier cliente `pg`. Aquí usamos
  [`postgres`](https://github.com/porsager/postgres) (postgres.js).
- **Assets**: Bunny CDN. Base pública: `https://lanzadera-digital.b-cdn.net/camar.es/…`
- **Idiomas**: el contenido traducible se guarda como JSON `{ es, en }`.
- **Cuerpo de las noticias**: Markdown (subconjunto reducido, ver §6).

---

## 2. Conexión a la base de datos

El front necesita una sola variable de entorno:

```bash
# .env del FRONT
DATABASE_URL="postgres://USER:PASSWORD@HOST/db?sslmode=require"
```

> Pide la cadena de conexión exacta (la misma `DATABASE_URL` que usa este panel).
> Para el front es recomendable un **rol de solo lectura**.

Cliente recomendado (idéntico al de este repo, [lib/supabase.ts](../lib/supabase.ts)):

```ts
// lib/db.ts  (en el front)
import postgres from 'postgres'

const sql = postgres(process.env.DATABASE_URL!, {
  ssl: 'require',
  idle_timeout: 20,
  max_lifetime: 60 * 30,
  prepare: false, // ⚠️ obligatorio con el pooler de Neon (transaction mode)
})

export default sql
```

⚠️ **`prepare: false` no es opcional**: el pooler de Neon trabaja en *transaction
mode* y sin esto aparecen errores tipo `cached plan must not change result type`.

Las consultas se hacen con *tagged templates* (parametrizadas y seguras frente a
inyección):

```ts
const noticias = await sql`SELECT * FROM noticias ORDER BY date DESC`
```

---

## 3. Esquema de tablas

Convenciones generales:

- Los campos `{ es, en }` son **JSONB**. `postgres.js` los devuelve ya como
  objetos JS. Aun así, **parsea de forma defensiva** (ver §7) por si hay filas
  legacy guardadas como string.
- Los campos de imagen de **noticias** y **proyectos** guardan **solo el nombre
  del archivo** (`foto.webp`); la URL se construye con la carpeta (ver §5).
- En **materiales**, `image_url` guarda la **URL completa**.

### 3.1 `noticias`

| Columna         | Tipo            | Descripción |
|-----------------|-----------------|-------------|
| `id`            | uuid            | Identificador. |
| `title`         | jsonb `{es,en}` | Titular. |
| `slug_es`       | text            | Slug/URL pública en español. |
| `slug_en`       | text            | Slug/URL pública en inglés. |
| `folder_custom` | text            | Carpeta de assets en Bunny. En registros nuevos **== `slug_es`**. |
| `date`          | date            | Fecha de publicación (`YYYY-MM-DD`). |
| `excerpt`       | jsonb `{es,en}` | Entradilla/resumen. |
| `content`       | jsonb `{es,en}` | Cuerpo en **Markdown** (ver §6). |
| `main_image`    | text            | Nombre de archivo de la portada. |
| `gallery`       | jsonb array     | `[{ type: 'image'\|'video', src: 'archivo.ext' }, …]`. |

**Base de assets:** `…/camar.es/Noticias/{folder_custom || slug_es}/{archivo}`

### 3.2 `proyectos`

| Columna             | Tipo            | Descripción |
|---------------------|-----------------|-------------|
| `id`                | uuid            | Identificador. |
| `slug`              | text            | Slug/URL pública. |
| `title`             | jsonb `{es,en}` | Nombre del proyecto. |
| `project_location`  | jsonb `{es,en}` | Ubicación. |
| `about_the_project` | jsonb `{es,en}` | Descripción larga. |
| `page_title`        | jsonb `{es,en}` | Título SEO de la página. |
| `page_description`  | jsonb `{es,en}` | Meta-descripción SEO. |
| `type`              | text[]          | Etiquetas en minúscula: `cocinas, hogar, suelos, baños, empresas, hoteles, singulares, religiosos, fuentes`. |
| `materials`         | text[]          | Nombres de materiales relacionados (coinciden con `materiales.material_name`). |
| `project_details`   | jsonb array     | Filas de ficha técnica (Categoría `{es,en}`, Fecha de realización `string`, País `{es,en}`, …). |
| `more_information`  | jsonb array     | Bloques extra (máx. 3). |
| `gallery`           | jsonb array     | `[{ type, src }, …]`. |
| `filter`            | text            | Categoría única del front: `Vivienda Privada, Hotel, Fuente, Religioso, Singular`. |
| `bg_image`          | text            | Nombre de archivo de la portada. |
| `main_image`        | text            | Nombre de archivo de la segunda imagen. |
| `folder`            | text            | Carpeta de assets en Bunny. **== `slug`**. |
| `show_on_projects`  | boolean         | Si `false`, no tiene página propia (solo "más información"). |
| `created_at`        | timestamp       | Alta. |

**Base de assets:** `…/camar.es/Proyectos/{folder}/{archivo}`

### 3.3 `materiales`

| Columna         | Tipo            | Descripción |
|-----------------|-----------------|-------------|
| `id`            | uuid            | Identificador. |
| `material_name` | text            | Nombre (ej. "Blanco Macael"). |
| `material_type` | jsonb `{es,en}` | Tipo. `es` ∈ `Mármol, Granito, Cuarcita, Caliza, Travertino, Ónix, Arenisca, Pórfido, Alabastro, Mineral`. |
| `location`      | jsonb `{es,en}` | Origen. |
| `description`   | jsonb `{es,en}` | Descripción. |
| `use`           | text[]          | Etiquetas de uso en minúscula (filtrable con `@>`). |
| `image_url`     | text            | **URL completa** de la imagen. Si está vacía, fallback: `…/camar.es/Materiales/{slug(material_name)}-hq.webp`. |

**Nota:** los materiales **no** usan subcarpeta: cuelgan de `…/camar.es/Materiales/`.

---

## 4. Idiomas

Todo campo `{ es, en }` se resuelve con el locale activo. Helper sugerido:

```ts
type Bilingual = { es?: string; en?: string }

export function pick(value: Bilingual | string | null | undefined, locale: 'es' | 'en') {
  if (!value) return ''
  if (typeof value === 'string') return value // fila legacy en un solo idioma
  return value[locale] || value.es || value.en || ''
}
```

Las URLs públicas usan `slug_es` / `slug_en` en noticias y `slug` en proyectos.

---

## 5. URLs de assets (Bunny CDN)

Base del Pull Zone: `https://lanzadera-digital.b-cdn.net`
Todo el contenido cuelga del prefijo `camar.es/`.

```ts
const CDN = 'https://lanzadera-digital.b-cdn.net/camar.es'

// NOTICIAS  — main_image y gallery[].src son solo nombres de archivo
export const noticiaAsset = (n: { folder_custom?: string; slug_es: string }, file: string) =>
  `${CDN}/Noticias/${n.folder_custom || n.slug_es}/${file}`

// PROYECTOS — bg_image, main_image y gallery[].src son solo nombres de archivo
export const proyectoAsset = (p: { folder: string }, file: string) =>
  `${CDN}/Proyectos/${p.folder}/${file}`

// MATERIALES — image_url ya es una URL completa
const DIACRITICS = /[̀-ͯ]/g // marcas combinantes tras normalize('NFD')

export const materialImage = (m: { image_url?: string; material_name: string }) => {
  if (m.image_url) return m.image_url
  const slug = m.material_name
    .toLowerCase().normalize('NFD').replace(DIACRITICS, '').replaceAll(' ', '-')
  return `${CDN}/Materiales/${slug}-hq.webp`
}
```

Los items de `gallery` pueden ser objetos `{ type, src }` o, en filas antiguas,
un string suelto. Normaliza siempre:

```ts
const items = (gallery ?? []).map((it: any) =>
  typeof it === 'string' ? { type: 'image', src: it } : it,
)
// it.type === 'video'  → renderiza <video>, si no <img>
```

---

## 6. Renderizado del Markdown (campo `content` de noticias)

El editor del panel produce un **subconjunto reducido y predecible** de Markdown.
Solo necesitas soportar:

| Sintaxis            | Resultado |
|---------------------|-----------|
| Línea en blanco     | Separador de **párrafos** (`<p>`). |
| `## Texto`          | Encabezado `<h2>`. |
| `### Texto`         | Subencabezado `<h3>`. |
| `**texto**`         | **Negrita** (`<strong>`). |
| `[texto](url)`      | Enlace `<a>`. |

No hay listas, imágenes embebidas, tablas ni HTML crudo. Cada párrafo va separado
por una línea en blanco (`\n\n`).

Recomendado: [`react-markdown`](https://github.com/remarkjs/react-markdown)
limitando los elementos permitidos.

```tsx
import ReactMarkdown from 'react-markdown'

<ReactMarkdown
  allowedElements={['p', 'h2', 'h3', 'strong', 'em', 'a', 'br']}
  unwrapDisallowed
  components={{
    a: ({ href, children }) => (
      <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>
    ),
  }}
>
  {pick(noticia.content, locale)}
</ReactMarkdown>
```

> Si prefieres no añadir dependencias, un conversor manual sirve perfectamente
> porque la sintaxis es muy acotada (partir por `\n{2,}`, detectar `## `/`### `,
> y reemplazar `**…**` y `[…](…)`).

---

## 7. Parseo defensivo de campos JSON

Los `jsonb` normalmente llegan como objetos, pero conviene blindarse ante filas
guardadas como string (o doble-stringificadas):

```ts
export function parseSafe<T>(value: any, fallback: T): T {
  if (value == null) return fallback
  if (typeof value !== 'string') return value as T
  try {
    const parsed = JSON.parse(value)
    return typeof parsed === 'string' ? JSON.parse(parsed) : parsed
  } catch {
    return fallback
  }
}

const title = parseSafe(noticia.title, { es: '', en: '' })
const gallery = parseSafe(noticia.gallery, [])
```

---

## 8. Consultas de ejemplo

```ts
// Listado de noticias (más recientes primero)
const noticias = await sql`SELECT * FROM noticias ORDER BY date DESC`

// Una noticia por slug (según idioma)
const [noticia] = await sql`
  SELECT * FROM noticias WHERE slug_es = ${slug} LIMIT 1
`

// Proyectos visibles en la home de proyectos
const proyectos = await sql`
  SELECT * FROM proyectos WHERE show_on_projects = true ORDER BY created_at DESC
`

// Proyectos por categoría del front
const porFiltro = await sql`
  SELECT * FROM proyectos WHERE filter = ${'Hotel'}
`

// Proyectos que contienen un type (array)
const cocinas = await sql`
  SELECT * FROM proyectos WHERE type @> ${['cocinas']}
`

// Materiales por uso (operador de contención JSON/array)
const materiales = await sql`
  SELECT * FROM materiales WHERE use @> ${JSON.stringify(['encimeras'])} LIMIT 4
`

// Materiales relacionados por tipo (acceso a propiedad dentro del JSONB)
const relacionados = await sql`
  SELECT * FROM materiales
  WHERE material_type->>'es' = ${'Mármol'}
    AND material_name != ${nombreActual}
  LIMIT 5
`
```

(Estos patrones están copiados de [lib/queries.ts](../lib/queries.ts), que ya los
usa en producción.)

---

## 9. Caché y publicación

Cuando se edita contenido en el panel, este hace dos cosas:

1. `revalidatePath(...)` sobre sus propias rutas.
2. Dispara un **deploy hook** (`triggerDeploy()`) para reconstruir el front.

Por tanto, en el front puedes elegir:

- **SSG/ISR** (recomendado): build estático que se regenera con el deploy hook al
  guardar en el panel. Añade `export const revalidate = 3600` o similar como red
  de seguridad.
- **SSR dinámico**: `export const dynamic = 'force-dynamic'` si quieres reflejar
  los cambios al instante sin esperar al rebuild.

---

## 10. Checklist de migración del front

- [ ] Añadir `DATABASE_URL` (rol de solo lectura) al entorno del front.
- [ ] Crear `lib/db.ts` con `postgres.js` y `prepare: false`.
- [ ] Helpers `pick()` (idioma), `parseSafe()` (JSON) y los builders de URL de §5.
- [ ] Reemplazar el contenido hardcodeado de **noticias** por lecturas de `noticias`.
- [ ] Reemplazar **proyectos** por lecturas de `proyectos` (respetar `show_on_projects` y `filter`).
- [ ] Reemplazar **materiales** por lecturas de `materiales` (`use`, `material_type`).
- [ ] Renderizar `noticias.content` con el Markdown reducido de §6.
- [ ] Verificar que las imágenes cargan con los builders de URL (ojo `folder_custom`/`folder`).
- [ ] Definir la estrategia de caché (§9).

---

### Resumen de rutas de assets

| Entidad   | Carpeta en Bunny                                | Campo de archivo                | URL completa |
|-----------|-------------------------------------------------|---------------------------------|--------------|
| Noticias  | `camar.es/Noticias/{folder_custom\|\|slug_es}/` | `main_image`, `gallery[].src`   | construir    |
| Proyectos | `camar.es/Proyectos/{folder}/`                  | `bg_image`, `main_image`, `gallery[].src` | construir |
| Materiales| `camar.es/Materiales/`                          | `image_url`                     | ya es completa |
