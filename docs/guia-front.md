# Guía de integración del FRONT (Astro) con la BD del admin

> Para el agente del repositorio del **front (Astro)**. El admin (`admin-camar`) escribe el
> contenido en una base de datos **Neon Postgres**; el front la **lee directamente**.
> Este documento es el contrato de datos completo: conexión, CDN, bilingüismo y el esquema
> de las tres tablas (`materiales`, `proyectos`, `noticias`).

---

## 1. Conexión a la base de datos

- Motor: **PostgreSQL (Neon)**, vía pooler (`-pooler` en el host).
- Cliente recomendado: [`postgres`](https://www.npmjs.com/package/postgres) (postgres.js).
- **IMPORTANTE**: usar `prepare: false`. Con el pooler de Neon (transaction mode) los prepared
  statements dan errores tras cambios de esquema (`cached plan must not change result type`).

```ts
// src/lib/db.ts
import postgres from 'postgres'
const url = import.meta.env.DATABASE_URL ?? process.env.DATABASE_URL
if (!url) throw new Error('DATABASE_URL no está definida')
export const sql = postgres(url, { ssl: 'require', prepare: false, max: 5 })
```

- `DATABASE_URL` en `.env` (y en el hosting). **Recomendado**: usar una credencial **read-only**
  (rol con solo `SELECT`), distinta de la del admin.
- `postgres.js` devuelve los `jsonb` **ya parseados** (objetos/arrays JS) y los `text[]` como arrays.
  Las columnas `text` que contienen JSON (ver §4) hay que parsearlas a mano.

---

## 2. CDN (imágenes y vídeos)

Todo el media está en **Bunny CDN**, no en la BD. Solo se guarda la URL (o, en noticias, el nombre de archivo).
- Base de lectura: `https://lanzadera-digital.b-cdn.net/camar.es/{Sección}/...`
- Formato preferente `.webp`; vídeos `.mp4` (`<video controls preload="metadata">`).
- En proyectos y materiales, los campos de imagen guardan **URL completa**. En noticias se guarda el **nombre de archivo** (ver §6).

---

## 3. Bilingüismo

Casi todos los textos son objetos `{ es, en }`. Resuélvelos por `locale`:
```ts
const t = (field, locale) => field?.[locale] ?? field?.es ?? ''
```
Dominios: **ES = `camar.es`**, **EN = `camarmarble.com`**.

---

## 4. Tabla `materiales`

| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid | |
| `material_name` | text | Nombre comercial (texto plano) |
| `material_type` | **text con JSON** | `{"es":"Mármol","en":"Marble"}` — **parsear** (puede ser string plano en datos antiguos) |
| `location` | **text con JSON** | `{"es":"Almería","en":"Spain"}` — **parsear** (idem) |
| `description` | **text con JSON** | `{"es":"...","en":"..."}` — **parsear** (idem) |
| `use` | text[] | minúsculas: `cocinas`, `baños`, `suelos`, `fuentes`, `hogar`, `empresas`, `singulares`, `hoteles`, `religiosos` |
| `image_url` | text | URL completa de la imagen en la CDN |
| `created_at` | timestamptz | |

> ⚠️ `material_type`/`location`/`description` son **text** que normalmente contienen JSON `{es,en}`,
> pero algún registro legacy puede ser texto plano. Usa un parse con fallback:
> ```ts
> const parse = (v) => { try { const o = JSON.parse(v); return typeof o === 'object' ? o : { es: v, en: v } } catch { return { es: v, en: v } } }
> ```
> No hay columna `slug`: el identificador de URL suele ser `slugify(material_name)`.

---

## 5. Tabla `proyectos` (reorganizada — leer con atención)

El antiguo blob `project_page` se ha separado en columnas. **No uses `project_name` ni `project_page`** (se eliminarán; ver §7).

| Columna | Tipo | Descripción |
|---|---|---|
| `id` | uuid | |
| `slug` | text | URL del proyecto |
| `title` | jsonb `{es,en}` | Nombre del proyecto |
| `project_location` | jsonb `{es,en}` | Ubicación |
| `bg_image` | text | **Portada** (imagen principal de la card y cabecera) |
| `main_image` | text | **Segunda imagen** (grande dentro de la página de proyecto) |
| `type` | text[] | Categorías de uso (minúsculas): `cocinas`, `hogar`, `suelos`, `baños`, `empresas`, `hoteles`, `singulares`, `religiosos`, `fuentes` |
| `filter` | text | Valor del **filtro del front**: `Vivienda Privada`, `Hotel`, `Fuente`, `Religioso`, `Singular` |
| `show_on_projects` | boolean | **Único criterio de visibilidad**: `true` ⇒ se renderiza la card en el grid / tiene página |
| `about_the_project` | jsonb `{es,en}` | Descripción larga. **Admite HTML** (p. ej. `<br>`) → renderizar con `set:html` (saneado) |
| `gallery` | jsonb array | `[{ "src": "<url>", "type": "image" }]` |
| `project_details` | jsonb array | 3 entradas fijas: `[{label:{es,en}, value:{es,en}}, {label:{es,en}, value:"2017"}, {label:{es,en}, value:{es,en}}]` → Categoría, Fecha de realización (value string), País |
| `more_information` | jsonb array (≤3) | `[{ title:{es,en}, content:{es,en} }]` |
| `materials` | text[] | Lista de materiales (texto libre, p. ej. `["Mármol Blanco", ...]`) |
| `page_title` | jsonb `{es,en}` | `<title>` (SEO) |
| `page_description` | jsonb `{es,en}` | meta description (SEO) |
| `folder` | text | Carpeta CDN del proyecto (referencia; las imágenes ya llevan URL completa) |
| `created_at` | timestamptz | |

**Reglas de render:**
- **Grid de proyectos**: mostrar la card **solo si `show_on_projects = true`**. Imagen de la card = `bg_image`.
- **Filtro del front**: usar la columna `filter`.
- **Página de detalle** (solo proyectos con `show_on_projects = true`): `title`, `bg_image`, `main_image`,
  `about_the_project` (HTML saneado), `gallery`, `project_details`, `more_information`, `materials`, y
  `page_title`/`page_description` en el `<head>`.
- `project_details[i].value` puede ser `{es,en}` (Categoría, País) o **string** (Fecha). Los `label` son fijos
  y vienen en ambos idiomas.

```sql
SELECT id, slug, title, project_location, bg_image, main_image, type, filter, show_on_projects,
       about_the_project, gallery, project_details, more_information, materials,
       page_title, page_description, folder
FROM proyectos
WHERE show_on_projects = true
ORDER BY created_at DESC
```

---

## 6. Tabla `noticias`

| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid | |
| `slug_es` / `slug_en` | text | Slugs por idioma |
| `date` | date | Fecha de publicación |
| `main_image` | text | **Solo nombre de archivo** |
| `gallery` | jsonb array | `[{ type:'image'|'video', src:'<archivo>' }]` (solo nombres) |
| `title` / `excerpt` / `content` | jsonb `{es,en}` | `content` es **Markdown** |
| `folder_custom` | text | Carpeta CDN |
| `created_at` | timestamptz | |

- URL de media de noticias: `https://lanzadera-digital.b-cdn.net/camar.es/Noticias/{folder_custom || slug_es}/{archivo}`.
- `content` es Markdown → convertir a HTML (p. ej. `marked`) y **sanear** antes de inyectar.

---

## 7. ⚠️ Secuencia de despliegue (proyectos)

El admin **ya escribe** en las columnas nuevas de `proyectos`, pero las columnas legacy
`project_name` y `project_page` **siguen existiendo** temporalmente para no romper el front actual.

1. Despliega el front leyendo las **columnas nuevas** (este documento).
2. Avisa al equipo del admin: ejecutarán `node scripts/projects-drop-legacy.mjs` para eliminar
   `project_name` y `project_page` definitivamente.

Hasta el paso 2 conviven ambos esquemas. **No** dependas de `project_page`/`project_name`.

---

## 8. Rebuild automático (deploy hook)

El admin dispara un **deploy hook de Cloudflare Pages** al crear/editar/borrar contenido
(materiales, proyectos, noticias), por lo que el front **se reconstruye solo** tras cada cambio.
No hay que configurar nada en el front para esto; solo tenerlo en cuenta (los cambios del admin
aparecen tras el rebuild, no en tiempo real).

---

## 9. Checklist
- [ ] `postgres` instalado, `src/lib/db.ts` con `prepare: false` y `DATABASE_URL` (read-only).
- [ ] Helper de bilingüismo `{es,en}` con fallback a `es`.
- [ ] Materiales: parsear `material_type`/`location`/`description` (text→JSON con fallback).
- [ ] Proyectos: usar columnas nuevas; grid filtrado por `show_on_projects`; `filter` para el filtro;
      `about_the_project` con `set:html` saneado; **no** usar `project_page`/`project_name`.
- [ ] Noticias: construir URLs de media con `folder_custom`; `content` Markdown saneado.
- [ ] Confirmar despliegue antes del drop de columnas legacy (§7).
