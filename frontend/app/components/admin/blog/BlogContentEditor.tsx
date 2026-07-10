'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useCreateBlockNote } from '@blocknote/react';
import { BlockNoteView } from '@blocknote/ariakit';
import { PartialBlock } from '@blocknote/core';
import '@blocknote/core/fonts/inter.css';
import '@blocknote/ariakit/style.css';
import { apiUrl } from '@/app/lib/apiRoot';
import ImageCropModal from '../../ImageCropModal';

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
  // Inline body images go through crop/rotate before upload. BlockNote's
  // uploadFile callback is a bare async function with no place to render a
  // modal, so we bridge it to component state via a pending promise: queue
  // the file, render ImageCropModal, and resolve/reject once the user
  // finishes (or cancels) the crop step.
  const [pendingBodyImage, setPendingBodyImage] = useState<File[] | null>(null);
  const cropHandlers = useRef<{ resolve: (url: string) => void; reject: (err: unknown) => void } | null>(null);

  const uploadFileWithCrop = (file: File): Promise<string> => {
    if (!file.type.startsWith('image/')) {
      // Non-image uploads (if BlockNote ever routes one through here) skip
      // the crop step entirely — nothing to crop.
      return uploadImage(file);
    }
    return new Promise<string>((resolve, reject) => {
      cropHandlers.current = { resolve, reject };
      setPendingBodyImage([file]);
    });
  };

  const editor = useCreateBlockNote({
    initialContent: initialBlocks.length > 0 ? initialBlocks : undefined,
    uploadFile: uploadFileWithCrop,
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

      {pendingBodyImage && (
        <ImageCropModal
          files={pendingBodyImage}
          onComplete={(edited) => {
            setPendingBodyImage(null);
            const handlers = cropHandlers.current;
            cropHandlers.current = null;
            if (!handlers) return;
            if (edited[0]) {
              uploadImage(edited[0]).then(handlers.resolve).catch(handlers.reject);
            } else {
              handlers.reject(new Error('Image crop produced no file'));
            }
          }}
          onCancel={() => {
            setPendingBodyImage(null);
            const handlers = cropHandlers.current;
            cropHandlers.current = null;
            handlers?.reject(new Error('Image upload cancelled'));
          }}
        />
      )}
    </div>
  );
}
