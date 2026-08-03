import { revalidatePath } from 'next/cache';
import { NextRequest, NextResponse } from 'next/server';

/**
 * On-demand ISR cache-busting, called by the backend right after it writes
 * something that a public page (`revalidate: 3600`, e.g. dealer/listing
 * pages) has already cached — without this, edits like a dealer's phone
 * number can take up to an hour to actually appear on the live site even
 * though the database write succeeds immediately.
 *
 * Auth: a shared secret header, since this is a server-to-server call from
 * the backend (Render), not something a browser should ever hit directly.
 */
export async function POST(request: NextRequest) {
  const secret = process.env.REVALIDATE_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'REVALIDATE_SECRET not configured' }, { status: 500 });
  }
  if (request.headers.get('x-revalidate-secret') !== secret) {
    return NextResponse.json({ error: 'Invalid secret' }, { status: 401 });
  }

  let paths: string[];
  try {
    const body = await request.json();
    const raw = body?.paths ?? body?.path;
    paths = Array.isArray(raw) ? raw : [raw];
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  paths = paths.filter((p): p is string => typeof p === 'string' && p.startsWith('/'));
  if (paths.length === 0) {
    return NextResponse.json({ error: 'No valid paths provided (must be an array of strings starting with /)' }, { status: 400 });
  }

  for (const path of paths) {
    revalidatePath(path);
  }

  return NextResponse.json({ revalidated: true, paths });
}
