"use client";

import { useEffect, useMemo, useRef } from "react";
import { Image as ImageIcon, Paperclip, Upload, X } from "lucide-react";
import {
  getFeedbackAttachmentPickerCountLabel,
  getFeedbackUiCopy,
  type FeedbackDictionary,
} from "@/lib/feedback-i18n";

interface FeedbackAttachmentPickerProps {
  lang: string;
  dict?: FeedbackDictionary;
  files: File[];
  onChange: (files: File[]) => void;
  maxFiles?: number;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function FeedbackAttachmentPicker({
  lang,
  dict = {},
  files,
  onChange,
  maxFiles = 4,
}: FeedbackAttachmentPickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const labels = getFeedbackUiCopy(lang, dict).attachments;

  const previews = useMemo(
    () =>
      files.map((file) => ({
        file,
        previewUrl: file.type.startsWith("image/") ? URL.createObjectURL(file) : null,
      })),
    [files]
  );

  useEffect(() => {
    return () => {
      for (const preview of previews) {
        if (preview.previewUrl) {
          URL.revokeObjectURL(preview.previewUrl);
        }
      }
    };
  }, [previews]);

  function handleFiles(selectedFiles: FileList | null) {
    if (!selectedFiles) return;

    const merged = [...files];
    for (const file of Array.from(selectedFiles)) {
      const exists = merged.some((entry) => entry.name === file.name && entry.size === file.size && entry.lastModified === file.lastModified);
      if (!exists && merged.length < maxFiles) {
        merged.push(file);
      }
    }

    onChange(merged.slice(0, maxFiles));
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }

  function removeAt(index: number) {
    onChange(files.filter((_, fileIndex) => fileIndex !== index));
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-text-secondary">{labels.pickerTitle}</p>
          <p className="mt-1 text-xs text-text-muted">{labels.pickerHint}</p>
        </div>
        <span className="text-xs text-text-muted">{getFeedbackAttachmentPickerCountLabel(lang, files.length, maxFiles, dict)}</span>
      </div>

      <div className="rounded-[14px] border border-dashed border-white/10 bg-white/3 p-4">
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".png,.jpg,.jpeg,.webp,.pdf,.txt,.json,image/png,image/jpeg,image/webp,application/pdf,text/plain,application/json"
          onChange={(e) => handleFiles(e.target.files)}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex w-full items-center justify-center gap-2 rounded-[10px] border border-white/10 bg-white/4 px-4 py-3 text-sm font-medium text-text-primary transition-colors hover:bg-white/6"
        >
          <Upload className="h-4 w-4" />
          {labels.pickerButton}
        </button>

        {previews.length > 0 && (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {previews.map((preview, index) => (
              <div key={`${preview.file.name}-${preview.file.lastModified}-${index}`} className="rounded-[12px] border border-white/8 bg-bg/50 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    {preview.previewUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={preview.previewUrl} alt={preview.file.name} className="h-12 w-12 rounded-[10px] object-cover" />
                    ) : (
                      <div className="flex h-12 w-12 items-center justify-center rounded-[10px] bg-white/4 text-text-muted">
                        {preview.file.type.startsWith("image/") ? <ImageIcon className="h-5 w-5" /> : <Paperclip className="h-5 w-5" />}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-text-primary">{preview.file.name}</p>
                      <p className="mt-1 text-xs text-text-muted">{formatFileSize(preview.file.size)}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeAt(index)}
                    className="rounded-full p-1 text-text-muted transition-colors hover:bg-white/6 hover:text-text-primary"
                    aria-label={labels.pickerRemove}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
