import React, { useEffect, useMemo, useState } from 'react';
import { Download, Maximize2, X, Check, Loader2 } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { GeneratedImageData } from '../lib/firebase';
import { Language } from '../lib/i18n';
import { apiUrl, isStaticHostWithoutBackend } from '../lib/api';

// In-memory cache so newly generated images render instantaneously without a second round-trip
const generatedImageDataUrlCache = new Map<string, string>();

export function cacheGeneratedImageDataUrl(url: string, dataUrl: string): void {
  if (!url || !dataUrl) return;
  generatedImageDataUrlCache.set(url, dataUrl);
  // Keep memory bounded to last 24 generated images
  if (generatedImageDataUrlCache.size > 24) {
    const oldestKey = generatedImageDataUrlCache.keys().next().value;
    if (oldestKey) generatedImageDataUrlCache.delete(oldestKey);
  }
}

interface GeneratedImageCardProps {
  image: GeneratedImageData;
  lang: Language;
}

function getDimensionsForRatio(ratio: GeneratedImageData['aspectRatio']): { w: number; h: number } {
  switch (ratio) {
    case '16:9':
      return { w: 1280, h: 720 };
    case '4:3':
      return { w: 1024, h: 768 };
    case '9:16':
      return { w: 720, h: 1280 };
    case '1:1':
    default:
      return { w: 1024, h: 1024 };
  }
}

function slugifyFilename(title: string): string {
  const clean = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return clean || 'longclaw-image';
}

export function GeneratedImageCard({ image, lang }: GeneratedImageCardProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [downloadedFmt, setDownloadedFmt] = useState<'image' | 'svg' | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    if (!lightboxOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightboxOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [lightboxOpen]);

  const isRaster = Boolean(image.dataUrl || image.url);

  const displaySrc = useMemo(() => {
    if (image.dataUrl) {
      return image.dataUrl;
    }
    if (image.url) {
      const cached = generatedImageDataUrlCache.get(image.url);
      if (cached) return cached;
      if (isStaticHostWithoutBackend()) return image.url;
      return apiUrl(`/api/image-proxy?url=${encodeURIComponent(image.url)}`);
    }
    if (image.svg) {
      try {
        return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(image.svg)}`;
      } catch {
        return '';
      }
    }
    return '';
  }, [image.dataUrl, image.url, image.svg]);

  const aspectClass =
    image.aspectRatio === '16:9'
      ? 'aspect-video max-w-2xl'
      : image.aspectRatio === '4:3'
        ? 'aspect-[4/3] max-w-xl'
        : image.aspectRatio === '9:16'
          ? 'aspect-[9/16] max-w-[300px]'
          : 'aspect-square max-w-[460px]';

  const handleDownloadSvg = () => {
    if (!image.svg) return;
    const blob = new Blob([image.svg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${slugifyFilename(image.title)}.svg`;
    a.click();
    URL.revokeObjectURL(url);
    setDownloadedFmt('svg');
    setTimeout(() => setDownloadedFmt(null), 1600);
  };

  const handleDownloadImage = async () => {
    if (!displaySrc) return;

    // Legacy SVG -> render to 2x PNG via canvas
    if (!isRaster && image.svg) {
      const { w, h } = getDimensionsForRatio(image.aspectRatio);
      const scale = 2;
      const canvas = document.createElement('canvas');
      canvas.width = w * scale;
      canvas.height = h * scale;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => {
          if (!blob) return;
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${slugifyFilename(image.title)}.png`;
          a.click();
          URL.revokeObjectURL(url);
          setDownloadedFmt('image');
          setTimeout(() => setDownloadedFmt(null), 1600);
        }, 'image/png');
      };
      img.src = displaySrc;
      return;
    }

    // Raster image -> direct blob download (works for both cached dataUrl and same-origin /api/image-proxy)
    try {
      setDownloading(true);
      const res = await fetch(displaySrc);
      const blob = await res.blob();
      const ext = blob.type.includes('png') ? 'png' : blob.type.includes('webp') ? 'webp' : 'jpg';
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${slugifyFilename(image.title)}.${ext}`;
      a.click();
      URL.revokeObjectURL(url);
      setDownloadedFmt('image');
      setTimeout(() => setDownloadedFmt(null), 1600);
    } catch {
      // Ignore transient download failure
    } finally {
      setDownloading(false);
    }
  };

  const labels =
    lang === 'tr'
      ? {
          downloadImage: 'Görseli İndir',
          downloadSvg: 'SVG',
          downloaded: 'İndirildi',
          expand: 'Büyüt',
          close: 'Kapat',
          loadFailed: 'Görsel yüklenemedi.',
        }
      : {
          downloadImage: 'Download Image',
          downloadSvg: 'SVG',
          downloaded: 'Saved',
          expand: 'Expand',
          close: 'Close',
          loadFailed: 'Could not load image.',
        };

  return (
    <>
      <div className="mt-2 space-y-2.5">
        <div
          className={`photo-frame-3d group relative w-full ${aspectClass} overflow-hidden rounded-2xl bg-[var(--surf)]`}
        >
          {!imageLoaded && !loadError && (
            <div className="absolute inset-0 flex items-center justify-center bg-[var(--surf)] animate-pulse">
              <Loader2 className="w-5 h-5 text-[var(--mut)] animate-spin" />
            </div>
          )}

          {loadError ? (
            <div className="w-full h-full flex items-center justify-center p-6 text-xs text-[var(--mut)] text-center">
              {labels.loadFailed}
            </div>
          ) : (
            displaySrc && (
              <img
                src={displaySrc}
                alt={image.title || image.prompt}
                referrerPolicy="no-referrer"
                onLoad={() => setImageLoaded(true)}
                onError={() => setLoadError(true)}
                className={`w-full h-full object-cover block cursor-zoom-in transition-opacity duration-300 ${
                  imageLoaded ? 'opacity-100' : 'opacity-0'
                }`}
                onClick={() => setLightboxOpen(true)}
              />
            )
          )}

          {imageLoaded && !loadError && (
            <button
              type="button"
              onClick={() => setLightboxOpen(true)}
              aria-label={labels.expand}
              title={labels.expand}
              className="absolute top-2.5 right-2.5 w-9 h-9 rounded-full bg-black/55 hover:bg-black/75 text-white flex items-center justify-center opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity cursor-pointer backdrop-blur-xs"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs text-[var(--mut)]">
          <button
            type="button"
            disabled={downloading || loadError}
            onClick={handleDownloadImage}
            className="inline-flex items-center gap-1.5 py-1 font-medium text-[var(--tx)]/85 hover:text-[var(--tx)] transition-colors cursor-pointer disabled:opacity-45"
          >
            {downloadedFmt === 'image' ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-500" />
                <span>{labels.downloaded}</span>
              </>
            ) : downloading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <>
                <Download className="w-3.5 h-3.5" />
                <span>{labels.downloadImage}</span>
              </>
            )}
          </button>

          {!isRaster && image.svg && (
            <button
              type="button"
              onClick={handleDownloadSvg}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full hover:bg-[var(--surf)] text-[var(--mut)] hover:text-[var(--tx)] font-medium transition-colors cursor-pointer"
            >
              {downloadedFmt === 'svg' ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-500" />
                  <span>{labels.downloaded}</span>
                </>
              ) : (
                <span>{labels.downloadSvg}</span>
              )}
            </button>
          )}

          <span className="text-[11px] text-[var(--mut)]">
            {image.title} · {image.aspectRatio}
          </span>
        </div>
      </div>

      <AnimatePresence>
        {lightboxOpen && displaySrc && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-[80] bg-black/85 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setLightboxOpen(false)}
          >
            <button
              type="button"
              onClick={() => setLightboxOpen(false)}
              aria-label={labels.close}
              className="fixed top-4 right-4 w-11 h-11 rounded-full bg-white/15 hover:bg-white/25 text-white flex items-center justify-center cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
            <motion.img
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              src={displaySrc}
              alt={image.title || image.prompt}
              referrerPolicy="no-referrer"
              className="max-w-[92vw] max-h-[86dvh] rounded-2xl shadow-2xl object-contain"
              onClick={(e) => e.stopPropagation()}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
