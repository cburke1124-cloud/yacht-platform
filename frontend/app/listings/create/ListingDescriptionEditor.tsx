'use client';

import { forwardRef, useEffect, useImperativeHandle, useMemo } from 'react';
import { useCreateBlockNote } from '@blocknote/react';
import { BlockNoteView } from '@blocknote/ariakit';
import { BlockNoteSchema, defaultBlockSpecs } from '@blocknote/core';
import { Bold, Italic, Underline, List, ListOrdered, Link2, Highlighter, Heading2, Heading3, Quote, Pilcrow } from 'lucide-react';
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

    // BlockNote only offers block-type conversion (heading/list/quote) via a
    // floating toolbar that appears when text is selected, or the "/" slash
    // menu — neither is discoverable to someone who doesn't already use rich
    // text editors. This persistent row makes the same actions the old
    // textarea toolbar had always visible, applied through BlockNote's real
    // block/style API instead of raw text wrapping.
    // Programmatic edits made through these buttons (as opposed to the user
    // typing directly into the editor) aren't guaranteed to trigger
    // BlockNoteView's onChange prop on their own, so each action explicitly
    // calls handleChange() afterward — otherwise the parent's form state
    // (and whatever gets sent to the backend on save) can silently stay on
    // the pre-edit HTML even though the editor visually shows the change.
    const setBlockType = (type: string, props?: Record<string, unknown>) => {
      editor.focus();
      const selection = editor.getSelection();
      const blocks = selection?.blocks?.length ? selection.blocks : [editor.getTextCursorPosition().block];
      blocks.forEach((b) => editor.updateBlock(b, { type, props } as any));
      handleChange();
    };

    const toggleStyle = (style: 'bold' | 'italic' | 'underline') => {
      editor.focus();
      editor.toggleStyles({ [style]: true } as any);
      handleChange();
    };

    const toggleHighlight = () => {
      editor.focus();
      const active = editor.getActiveStyles();
      if ((active as any).backgroundColor) {
        editor.removeStyles({ backgroundColor: (active as any).backgroundColor } as any);
      } else {
        editor.addStyles({ backgroundColor: 'yellow' } as any);
      }
      handleChange();
    };

    const insertLink = () => {
      const url = window.prompt('Link URL');
      if (!url) return;
      editor.focus();
      if (editor.getSelectedText()) {
        editor.createLink(url);
      } else {
        const text = window.prompt('Link text', url) || url;
        editor.createLink(url, text);
      }
      handleChange();
    };

    const btnCls = 'p-2 text-xs border border-gray-200 rounded-md hover:bg-gray-50';

    return (
      <div className="space-y-2">
        <div className="flex flex-wrap gap-2">
          <button type="button" title="Heading" onClick={() => setBlockType('heading', { level: 2 })} className={btnCls}><Heading2 size={14} /></button>
          <button type="button" title="Subheading" onClick={() => setBlockType('heading', { level: 3 })} className={btnCls}><Heading3 size={14} /></button>
          <button type="button" title="Bold" onClick={() => toggleStyle('bold')} className={btnCls}><Bold size={14} /></button>
          <button type="button" title="Italic" onClick={() => toggleStyle('italic')} className={btnCls}><Italic size={14} /></button>
          <button type="button" title="Underline" onClick={() => toggleStyle('underline')} className={btnCls}><Underline size={14} /></button>
          <button type="button" title="Highlight" onClick={toggleHighlight} className={btnCls}><Highlighter size={14} /></button>
          <button type="button" title="Link" onClick={insertLink} className={btnCls}><Link2 size={14} /></button>
          <button type="button" title="Bulleted list" onClick={() => setBlockType('bulletListItem')} className={btnCls}><List size={14} /></button>
          <button type="button" title="Numbered list" onClick={() => setBlockType('numberedListItem')} className={btnCls}><ListOrdered size={14} /></button>
          <button type="button" title="Quote" onClick={() => setBlockType('quote')} className={btnCls}><Quote size={14} /></button>
          <button type="button" title="Paragraph" onClick={() => setBlockType('paragraph')} className={btnCls}><Pilcrow size={14} /></button>
        </div>
        <div className="border border-gray-200 rounded-lg min-h-[280px] [&_.bn-editor]:min-h-[280px]">
          <BlockNoteView editor={editor} onChange={handleChange} theme="light" />
        </div>
      </div>
    );
  }
);

export default ListingDescriptionEditor;
