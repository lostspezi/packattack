import { Download, FileText, Image as ImageIcon, Paperclip } from "lucide-react";
import type { FeedbackAttachmentSummary } from "@/types/feedback";
import { getFeedbackUiCopy, type FeedbackDictionary } from "@/lib/feedback-i18n";

interface FeedbackAttachmentListProps {
  lang: string;
  dict?: FeedbackDictionary;
  attachments: FeedbackAttachmentSummary[];
  compact?: boolean;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function FeedbackAttachmentList({ lang, dict = {}, attachments, compact = false }: FeedbackAttachmentListProps) {
  if (attachments.length === 0) {
    return null;
  }

  const labels = getFeedbackUiCopy(lang, dict).attachments;

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-text-secondary">{labels.title}</p>
      <div className={compact ? "space-y-2" : "grid gap-3 sm:grid-cols-2"}>
        {attachments.map((attachment) => (
          <a
            key={attachment.attachmentId}
            href={attachment.url}
            target="_blank"
            rel="noreferrer"
            className="group block overflow-hidden rounded-[12px] border border-white/8 bg-white/3 transition-colors hover:bg-white/5"
          >
            {attachment.isImage && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={attachment.url}
                alt={attachment.filename}
                className="h-32 w-full object-cover"
              />
            )}
            <div className="flex items-center justify-between gap-3 p-3">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-white/4 text-text-muted">
                  {attachment.isImage ? (
                    <ImageIcon className="h-4 w-4" />
                  ) : attachment.contentType === "application/pdf" ? (
                    <FileText className="h-4 w-4" />
                  ) : (
                    <Paperclip className="h-4 w-4" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-text-primary">{attachment.filename}</p>
                  <p className="mt-1 text-xs text-text-muted">{formatFileSize(attachment.size)}</p>
                </div>
              </div>
              <div className="flex items-center gap-1 text-xs text-text-muted transition-colors group-hover:text-text-primary">
                <Download className="h-4 w-4" />
                <span className="hidden sm:inline">{labels.download}</span>
              </div>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}
