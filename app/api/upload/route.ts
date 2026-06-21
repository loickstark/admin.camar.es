// /app/api/upload/route.ts
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';

// Solo se permite subir a estas carpetas de nivel superior.
const ALLOWED_FOLDERS = ['Materiales', 'Noticias', 'Proyectos'] as const;

/**
 * Devuelve un nombre de archivo seguro (sin rutas ni traversal) o null si no es válido.
 */
function safeFileName(raw: string): string | null {
  // Nos quedamos solo con el nombre base, descartando cualquier ruta.
  const base = raw.split('/').pop()?.split('\\').pop() ?? '';
  if (!base || base === '.' || base === '..') return null;
  // Solo caracteres seguros para una URL/nombre de archivo.
  if (!/^[A-Za-z0-9._-]+$/.test(base)) return null;
  return base;
}

export async function PUT(request: Request) {
  // 1) Exigir sesión válida. Sin esto, la ruta era pública.
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const rawFile = searchParams.get('file');
  const folder = searchParams.get('folder'); // 'Materiales', 'Noticias' o 'Proyectos'

  // 2) Validar la carpeta contra una lista blanca.
  if (!folder || !ALLOWED_FOLDERS.includes(folder as (typeof ALLOWED_FOLDERS)[number])) {
    return NextResponse.json({ error: 'Carpeta no válida' }, { status: 400 });
  }

  // 3) Sanear el nombre de archivo (evita path traversal tipo ../).
  const fileName = rawFile ? safeFileName(rawFile) : null;
  if (!fileName) {
    return NextResponse.json({ error: 'Nombre de archivo no válido' }, { status: 400 });
  }

  // 4) Credenciales SOLO desde el entorno (sin fallback hardcodeado).
  const storageZone = process.env.BUNNY_STORAGE_ZONE;
  const accessKey = process.env.BUNNY_ACCESS_KEY;
  if (!storageZone || !accessKey) {
    console.error('Faltan BUNNY_STORAGE_ZONE / BUNNY_ACCESS_KEY');
    return NextResponse.json({ error: 'Configuración del servidor incompleta' }, { status: 500 });
  }

  // RUTA FINAL: /lanzadera-digital/camar.es/Carpeta/archivo.webp
  const bunnyUrl = `https://storage.bunnycdn.com/${storageZone}/camar.es/${folder}/${fileName}`;

  try {
    const arrayBuffer = await request.arrayBuffer();

    const response = await fetch(bunnyUrl, {
      method: 'PUT',
      headers: {
        'AccessKey': accessKey,
        'Content-Type': 'application/octet-stream',
      },
      body: Buffer.from(arrayBuffer),
    });

    if (response.ok) {
      return NextResponse.json({ success: true, fileName });
    } else {
      const errorMsg = await response.text();
      return NextResponse.json({ error: errorMsg }, { status: response.status });
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
