'use client';

import { useEffect, useMemo } from 'react';
import { useCreateBlockNote } from '@blocknote/react';
import { BlockNoteView } from '@blocknote/ariakit';
import { PartialBlock } from '@blocknote/core';
import '@blocknote/core/fonts/inter.css';
import '@blocknote/ariakit/style.css';
import { apiUrl } from '@/app/lib/apiRoot';

interface BlogContentEditorProps {
  initialBlocks: PartialBlock[];
  onChange: (blocks: PartialBlock[], html: string) => void;
}

async function uploadImage(file: File): Promise<string> {
  const token = localStorage.getItem('token');
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(apiUrl('/media/upload'), {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });

  if (!response.ok) {
    throw new Error('Image upload failed');
  }
  const data = await response.json();
  return data.media.url as string;
}

/** Splits legacy plain-text content into one paragraph block per blank-line-separated chunk. */
export function legacyTextToBlocks(text: string): PartialBlock[] {
  const paragraphs = text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  if (paragraphs.length === 0) {
    return [{ type: 'paragraph', content: [] }];
  }
  return paragraphs.map((p) => ({
    type: 'paragraph',
    content: p,
  }));
}

export default function BlogContentEditor({ initialBlocks, onChange }: BlogContentEditorProps) {
  const editor = useCreateBlockNote({
    initialContent: initialBlocks.length > 0 ? initialBlocks : undefined,
    uploadFile: uploadImage,
  });

  const handleChange = useMemo(
    () => async () => {
      const html = await editor.blocksToFullHTML(editor.document);
      onChange(editor.document, html);
    },
    [editor, onChange]
  );

  // Seed content_blocks/content_html as soon as the block editor mounts, even
  // if the writer hasn't edited content yet — so a legacy post that's simply
  // opened and saved (e.g. only a title tweak) still converts over.
  useEffect(() => {
    handleChange();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="border border-gray-200 rounded-lg min-h-[400px] [&_.bn-editor]:min-h-[400px]">
      <BlockNoteView editor={editor} onChange={handleChange} theme="light" />
    </div>
  );
}
