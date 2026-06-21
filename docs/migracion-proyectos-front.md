# Migración del esquema de Proyectos — guía para el FRONT (Astro)

> Para el agente del repo del front. El admin ha **reorganizado la tabla `proyectos`**:
> el blob `project_page` se ha separado en **columnas propias** y `project_name` se ha
> fusionado en `title`. Hay que actualizar las queries/lecturas del front.

## Cambios clave
- ❌ **Desaparecen** las columnas `project_name` y `project_page`.
- ✅ Todo lo que estaba dentro de `project_page` pasa a **columnas top-level**.
- El nombre del proyecto está ahora **siempre en `title`** (jsonb `{es,en}`).

## Mapeo (antiguo → nuevo)
| Antes (`project_page.X` o columna) | Ahora (columna) | Tipo |
|---|---|---|
| `project_name` / `title` | `title` | jsonb `{es,en}` |
| `project_location` | `project_location` | jsonb `{es,en}` (igual) |
| `bg_image` | `bg_image` | text — **portada** |
| `main_image` | `main_image` | text — segunda imagen |
| `type` | `type` | text[] (minúsculas: `cocinas`, `hogar`, `suelos`, `baños`, `empresas`, `hoteles`, `singulares`, `religiosos`, `fuentes`) |
| `project_page.sobreElProyecto` | `about_the_project` | jsonb `{es,en}` (admite HTML, p. ej. `<br>`) |
| `project_page.projectDetails` | `project_details` | jsonb array `{label:{es,en}, value:{es,en}}` |
| `project_page.gallery` | `gallery` | jsonb array `{src,type}` |
| `project_page.masInformacion` | `more_information` | jsonb array `{title:{es,en}, content:{es,en}}` (máx 3) |
| `project_page.materials` | `materials` | text[] |
| `project_page.pageTitle` | `page_title` | jsonb `{es,en}` |
| `project_page.pageDescription` | `page_description` | jsonb `{es,en}` |
| `project_page.filtro` | `filter` | text (`Vivienda Privada`, `Hotel`, `Fuente`, `Religioso`, `Singular`) |
| `project_page.folder` | `folder` | text (carpeta CDN) |
| (nuevo) | `show_on_projects` | boolean — **único flag**: `true` = se renderiza la card en el grid (tiene página de proyecto) |

> `project_page.hideFromGallery` **se elimina** (no se usa). El único control de visibilidad es `show_on_projects`.

> Nota: en `project_details`, el `value` ahora es **siempre** `{es,en}` (antes algunos eran string; se han normalizado).

## Qué cambiar en el front
1. **SELECT**: dejar de leer `project_page`/`project_name`; leer las columnas nuevas directamente.
   ```sql
   SELECT id, slug, title, project_location, bg_image, main_image, type,
          about_the_project, project_details, gallery, more_information, materials,
          page_title, page_description, filter, folder, show_on_projects
   FROM proyectos
   ```
2. **Listado/grid de proyectos**: renderizar la card **solo si `show_on_projects = true`** (es el único criterio de visibilidad).
3. **Página de detalle**: usar `title`, `about_the_project`, `gallery`, `project_details`, `more_information`, `materials`, `bg_image`, `main_image`, y `page_title`/`page_description` para el `<head>`.
4. **Filtro del front**: usar la columna `filter`.
5. `postgres.js` devuelve los `jsonb` ya parseados (objetos/arrays JS); `type` y `materials` llegan como arrays.

## ⚠️ Secuencia de despliegue (importante)
El admin **ya** escribe en las columnas nuevas, pero las columnas legacy (`project_name`, `project_page`) **siguen existiendo** hasta que se ejecute el script de borrado. Para no romper el front:

1. Despliega el front con las lecturas nuevas (este documento).
2. **Después**, en el repo del admin, ejecuta `node scripts/projects-drop-legacy.mjs` para eliminar `project_name` y `project_page` definitivamente.

Hasta el paso 2, ambos esquemas conviven (el admin no toca `project_page`, pero sigue presente).
