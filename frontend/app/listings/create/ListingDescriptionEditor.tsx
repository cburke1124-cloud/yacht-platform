'use client';

import { forwardRef, useEffect, useImperativeHandle, useMemo } from 'react';
import { useCreateBlockNote } from '@blocknote/react';
import { BlockNoteView } from '@blocknote/ariakit';
import { BlockNoteSchema, defaultBlockSpecs } from '@blocknote/core';
import '@blocknote/core/fonts/inter.css';
import '@blocknote/ariakit/style.css';

// Listing photos already have a dedicated Media tab — don't offer a second,
// confusing way to embed images/video/audio/files inside the description.
const { image, video, audio, file, ...listingBlockSpecs } = defaultBlockSpecs;
const schema = BlockNoteSchema.create({ blockSpecs: listingBlockSpecs });

export interface ListingDescriptionEditorHandle {
  setHTML: (html: string) => void;
}

interface ListingDescriptionEditorProps {
  initialHTML: string;
  onChange: (html: string) => void;
}

const ListingDescriptionEditor = forwardRef<ListingDescriptionEditorHandle, ListingDescriptionEditorProps>(
  function ListingDescriptionEditor({ initialHTML, onChange }, ref) {
    const editor = useCreateBlockNote({ schema });

    const handleChange = useMemo(
      () => async () => {
        const html = await editor.blocksToHTMLLossy(editor.document);
        onChange(html);
      },
      [editor, onChange]
    );

    // Seed the editor from the HTML string once on mount — BlockNote needs
    // blocks at construction time, but parsing HTML requires an editor
    // instance to already exist, so this two-step bootstrap is unavoidable.
    useEffect(() => {
      if (!initialHTML || !initialHTML.trim()) return;
      Promise.resolve(editor.tryParseHTMLToBlocks(initialHTML)).then((blocks) => {
        if (blocks && blocks.length > 0) {
          editor.replaceBlocks(editor.document, blocks);
        }
      });
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useImperativeHandle(ref, () => ({
      setHTML: (html: string) => {
        Promise.resolve(editor.tryParseHTMLToBlocks(html)).then((blocks) => {
          editor.replaceBlocks(editor.document, blocks && blocks.length > 0 ? blocks : [{ type: 'paragraph', content: [] }]);
          handleChange();
        });
      },
    }));

    return (
      <div className="border border-gray-200 rounded-lg min-h-[280px] [&_.bn-editor]:min-h-[280px]">
        <BlockNoteView editor={editor} onChange={handleChange} theme="light" />
      </div>
    );
  }
);

export default ListingDescriptionEditor;
