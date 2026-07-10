'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { RotateCcw, RotateCw, Check, X, SkipForward } from 'lucide-react';

/**
 * Shared crop/rotate step for every image upload entry point in the app.
 * Takes a queue of raw File objects, shows each one in turn with rotate
 * (90deg increments) + a freeform draggable/resizable crop box, and hands
 * back the edited files (as JPEG Blobs wrapped in File) once the whole
 * queue is done. No new npm dependency — plain canvas + pointer events.
 */

interface ImageCropModalProps {
  /** Files to process, one at a time, in order. Non-image files are passed
   * through untouched (no crop UI shown for them). */
  files: File[];
  /** Called once every file has been applied or skipped. */
  onComplete: (edited: File[]) => void;
  /** User closed the modal without finishing — caller should not upload anything. */
  onCancel: () => void;
  /** Optional fixed aspect ratio (width / height) for the crop box, e.g. 1 for
   * a square logo. Omit for freeform cropping (the default, used for listing photos). */
  aspect?: number;
}

type Box = { x: number; y: number; width: number; height: number };
type DragMode = null | 'move' | 'nw' | 'ne' | 'sw' | 'se';

const VIEWPORT_MAX_W = 560;
const VIEWPORT_MAX_H = 420;
const MIN_BOX = 24;

export default function ImageCropModal({ files, onComplete, onCancel, aspect }: ImageCropModalProps) {
  const imageFiles = files; // caller is expected to only pass image/* files in
  const [index, setIndex] = useState(0);
  const [rotation, setRotation] = useState(0); // 0 | 90 | 180 | 270
  const [imgUrl, setImgUrl] = useState<string | null>(null);
  const [naturalSize, setNaturalSize] = useState({ width: 0, height: 0 });
  const [displaySize, setDisplaySize] = useState({ width: 0, height: 0 });
  const [box, setBox] = useState<Box>({ x: 0, y: 0, width: 0, height: 0 });
  const [dragMode, setDragMode] = useState<DragMode>(null);
  const dragStart = useRef<{ x: number; y: number; box: Box } | null>(null);
  const [edited, setEdited] = useState<File[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  const current = imageFiles[index];

  // Load current file into an object URL + get its natural dimensions.
  useEffect(() => {
    if (!current) return;
    const url = URL.createObjectURL(current);
    setImgUrl(url);
    setRotation(0);
    const img = new window.Image();
    img.onload = () => setNaturalSize({ width: img.naturalWidth, height: img.naturalHeight });
    img.src = url;
    return () => URL.revokeObjectURL(url);
  }, [current]);

  // Compute displayed (rotation-aware) size + reset the crop box to the
  // full image whenever the file or rotation changes.
  useEffect(() => {
    if (!naturalSize.width || !naturalSize.height) return;
    const rotated90 = rotation === 90 || rotation === 270;
    const nw = rotated90 ? naturalSize.height : naturalSize.width;
    const nh = rotated90 ? naturalSize.width : naturalSize.height;
    const scale = Math.min(VIEWPORT_MAX_W / nw, VIEWPORT_MAX_H / nh, 1);
    const dw = Math.round(nw * scale);
    const dh = Math.round(nh * scale);
    setDisplaySize({ width: dw, height: dh });

    if (aspect) {
      let w = dw, h = dw / aspect;
      if (h > dh) { h = dh; w = dh * aspect; }
      setBox({ x: (dw - w) / 2, y: (dh - h) / 2, width: w, height: h });
    } else {
      setBox({ x: 0, y: 0, width: dw, height: dh });
    }
  }, [naturalSize, rotation, aspect]);

  const clampBox = useCallback((b: Box): Box => {
    let { x, y, width, height } = b;
    width = Math.max(MIN_BOX, Math.min(width, displaySize.width));
    height = aspect ? width / aspect : Math.max(MIN_BOX, Math.min(height, displaySize.height));
    x = Math.max(0, Math.min(x, displaySize.width - width));
    y = Math.max(0, Math.min(y, displaySize.height - height));
    return { x, y, width, height };
  }, [displaySize, aspect]);

  const onPointerDown = (mode: DragMode) => (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    (e.target as Element).setPointerCapture(e.pointerId);
    dragStart.current = { x: e.clientX, y: e.clientY, box };
    setDragMode(mode);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragMode || !dragStart.current) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    const start = dragStart.current.box;
    let next: Box = { ...start };

    if (dragMode === 'move') {
      next = { ...start, x: start.x + dx, y: start.y + dy };
    } else {
      if (dragMode.includes('w')) { next.x = start.x + dx; next.width = start.width - dx; }
      if (dragMode.includes('e')) { next.width = start.width + dx; }
      if (dragMode.includes('n')) { next.y = start.y + dy; next.height = start.height - dy; }
      if (dragMode.includes('s')) { next.height = start.height + dy; }
    }
    setBox(clampBox(next));
  };

  const onPointerUp = () => {
    setDragMode(null);
    dragStart.current = null;
  };

  const rotate = (dir: 1 | -1) => {
    setRotation(r => ((r + dir * 90) + 360) % 360);
  };

  const applyCurrentCrop = async (): Promise<File> => {
    if (!imgUrl || !current) return current;

    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new window.Image();
      el.onload = () => resolve(el);
      el.onerror = reject;
      el.src = imgUrl;
    });

    const rotated90 = rotation === 90 || rotation === 270;
    const rw = rotated90 ? naturalSize.height : naturalSize.width;
    const rh = rotated90 ? naturalSize.width : naturalSize.height;

    // Draw the rotated full image onto an offscreen canvas first.
    const rotCanvas = document.createElement('canvas');
    rotCanvas.width = rw;
    rotCanvas.height = rh;
    const rctx = rotCanvas.getContext('2d');
    if (!rctx) return current;
    rctx.translate(rw / 2, rh / 2);
    rctx.rotate((rotation * Math.PI) / 180);
    rctx.drawImage(img, -naturalSize.width / 2, -naturalSize.height / 2);

    // Map the on-screen crop box (in displayed px) to natural px on the rotated canvas.
    const scaleX = rw / displaySize.width;
    const scaleY = rh / displaySize.height;
    const cropX = Math.round(box.x * scaleX);
    const cropY = Math.round(box.y * scaleY);
    const cropW = Math.max(1, Math.round(box.width * scaleX));
    const cropH = Math.max(1, Math.round(box.height * scaleY));

    const outCanvas = document.createElement('canvas');
    outCanvas.width = cropW;
    outCanvas.height = cropH;
    const octx = outCanvas.getContext('2d');
    if (!octx) return current;
    octx.drawImage(rotCanvas, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);

    const blob: Blob | null = await new Promise(resolve => outCanvas.toBlob(resolve, 'image/jpeg', 0.9));
    if (!blob) return current;

    const base = current.name.replace(/\.[^.]+$/, '');
    return new File([blob], `${base}.jpg`, { type: 'image/jpeg' });
  };

  const goNext = (file: File) => {
    const nextEdited = [...edited, file];
    if (index + 1 < imageFiles.length) {
      setEdited(nextEdited);
      setIndex(index + 1);
    } else {
      onComplete(nextEdited);
    }
  };

  const handleApply = async () => {
    const file = await applyCurrentCrop();
    goNext(file);
  };

  const handleSkip = () => {
    goNext(current);
  };

  if (!current) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4" onClick={onCancel}>
      <div className="w-full max-w-2xl rounded-xl bg-white p-5" onClick={e => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-gray-900">Crop &amp; rotate photo</h3>
            {imageFiles.length > 1 && (
              <p className="text-xs text-gray-400">Photo {index + 1} of {imageFiles.length}</p>
            )}
          </div>
          <button type="button" onClick={onCancel} className="text-gray-400 hover:text-gray-700">
            <X size={18} />
          </button>
        </div>

        <div
          ref={containerRef}
          className="relative mx-auto select-none overflow-hidden rounded-lg bg-gray-900"
          style={{ width: displaySize.width || 1, height: displaySize.height || 1, touchAction: 'none' }}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
        >
          {imgUrl && (
            <img
              src={imgUrl}
              alt="Crop preview"
              draggable={false}
              style={{
                position: 'absolute',
                left: '50%',
                top: '50%',
                width: rotation === 90 || rotation === 270 ? displaySize.height : displaySize.width,
                height: rotation === 90 || rotation === 270 ? displaySize.width : displaySize.height,
                transform: `translate(-50%, -50%) rotate(${rotation}deg)`,
              }}
            />
          )}

          {/* Dimmed overlay outside the crop box */}
          <div className="pointer-events-none absolute inset-0 bg-black/50" style={{
            clipPath: `polygon(0 0, 100% 0, 100% 100%, 0 100%, 0 ${box.y}px, ${box.x}px ${box.y}px, ${box.x}px ${box.y + box.height}px, ${box.x + box.width}px ${box.y + box.height}px, ${box.x + box.width}px ${box.y}px, 0 ${box.y}px)`,
          }} />

          {/* Crop box */}
          <div
            className="absolute cursor-move border-2 border-white"
            style={{ left: box.x, top: box.y, width: box.width, height: box.height }}
            onPointerDown={onPointerDown('move')}
          >
            {(['nw', 'ne', 'sw', 'se'] as const).map(corner => (
              <div
                key={corner}
                onPointerDown={onPointerDown(corner)}
                className="absolute h-4 w-4 rounded-full border-2 border-[#10214F] bg-white"
                style={{
                  cursor: corner === 'nw' || corner === 'se' ? 'nwse-resize' : 'nesw-resize',
                  left: corner.includes('w') ? -8 : undefined,
                  right: corner.includes('e') ? -8 : undefined,
                  top: corner.includes('n') ? -8 : undefined,
                  bottom: corner.includes('s') ? -8 : undefined,
                }}
              />
            ))}
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => rotate(-1)} title="Rotate left"
              className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50">
              <RotateCcw size={14} /> Rotate
            </button>
            <button type="button" onClick={() => rotate(1)} title="Rotate right"
              className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50">
              <RotateCw size={14} /> Rotate
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={handleSkip}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-gray-500 hover:bg-gray-50">
              <SkipForward size={14} /> Use original
            </button>
            <button type="button" onClick={handleApply}
              className="flex items-center gap-1.5 rounded-lg bg-[#10214F] px-4 py-1.5 text-xs font-medium text-white hover:bg-[#1a3570]">
              <Check size={14} /> {index + 1 < imageFiles.length ? 'Apply & next' : 'Apply'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
