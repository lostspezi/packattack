"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pencil, Plus, Trash2, ArrowLeft, Image as ImageIcon } from "lucide-react";

type NewsType = "release" | "event" | "community";
type NewsStatus = "draft" | "published";

interface NewsPost {
  _id: string;
  title: string;
  slug: string;
  excerpt: string;
  body?: string;
  type: NewsType;
  imageId: string | null;
  imageAlt: string;
  status: NewsStatus;
  publishedAt: string | null;
  authorId: string;
  createdAt: string;
  updatedAt: string;
}

type View =
  | { kind: "list" }
  | { kind: "edit"; post: NewsPost }
  | { kind: "new" };

interface FormState {
  title: string;
  body: string;
  excerpt: string;
  type: NewsType;
  status: NewsStatus;
  imageAlt: string;
  imageFile: File | null;
  removeImage: boolean;
  existingImageId: string | null;
}

const EMPTY_FORM: FormState = {
  title: "",
  body: "",
  excerpt: "",
  type: "release",
  status: "draft",
  imageAlt: "",
  imageFile: null,
  removeImage: false,
  existingImageId: null,
};

function formStateFromPost(post: NewsPost): FormState {
  return {
    title: post.title,
    body: post.body ?? "",
    excerpt: post.excerpt ?? "",
    type: post.type,
    status: post.status,
    imageAlt: post.imageAlt ?? "",
    imageFile: null,
    removeImage: false,
    existingImageId: post.imageId,
  };
}

const TYPE_LABEL: Record<NewsType, string> = {
  release: "Release",
  event: "Event",
  community: "Community",
};

const STATUS_LABEL: Record<NewsStatus, string> = {
  draft: "Entwurf",
  published: "Veröffentlicht",
};

function formatDate(value: string | null): string {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString("de-DE", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return value;
  }
}

function badgeVariantForStatus(status: NewsStatus) {
  return status === "published" ? "success" : "info";
}

function badgeVariantForType(type: NewsType) {
  if (type === "release") return "info";
  if (type === "event") return "warning";
  return "user";
}

export function NewsManager() {
  const [view, setView] = useState<View>({ kind: "list" });
  const [posts, setPosts] = useState<NewsPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<"all" | NewsStatus>("all");
  const [error, setError] = useState("");

  const fetchPosts = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const url =
        statusFilter === "all"
          ? "/api/admin/news"
          : `/api/admin/news?status=${statusFilter}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("fetch_failed");
      const data = (await res.json()) as { posts: NewsPost[] };
      setPosts(data.posts ?? []);
    } catch {
      setError("Konnte News nicht laden.");
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  const onCreated = () => {
    setView({ kind: "list" });
    fetchPosts();
  };

  const onUpdated = () => {
    setView({ kind: "list" });
    fetchPosts();
  };

  const onDelete = async (post: NewsPost) => {
    const ok = confirm(`"${post.title}" wirklich löschen?`);
    if (!ok) return;
    try {
      const res = await fetch(`/api/admin/news/${post._id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("delete_failed");
      setPosts((prev) => prev.filter((p) => p._id !== post._id));
    } catch {
      setError("Löschen fehlgeschlagen.");
    }
  };

  const filteredPosts = useMemo(() => posts, [posts]);

  if (view.kind === "new") {
    return (
      <NewsForm
        title="Neue News erstellen"
        initial={EMPTY_FORM}
        onCancel={() => setView({ kind: "list" })}
        onSaved={() => onCreated()}
      />
    );
  }

  if (view.kind === "edit") {
    return (
      <NewsForm
        title={`Bearbeiten: ${view.post.title}`}
        initial={formStateFromPost(view.post)}
        postId={view.post._id}
        onCancel={() => setView({ kind: "list" })}
        onSaved={() => onUpdated()}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-text-primary">News verwalten</h2>
          <p className="text-text-secondary mt-1 text-sm">
            Beiträge für das Dashboard. Veröffentlichte News erscheinen sofort.
          </p>
        </div>
        <Button onClick={() => setView({ kind: "new" })}>
          <Plus className="w-4 h-4" /> Neue News
        </Button>
      </div>

      <Card variant="soft" className="p-4 flex items-center gap-2">
        <span className="text-text-secondary text-sm">Filter:</span>
        {(["all", "published", "draft"] as const).map((opt) => (
          <button
            key={opt}
            onClick={() => setStatusFilter(opt)}
            className={`px-3 py-1 rounded-[8px] text-sm cursor-pointer ${
              statusFilter === opt
                ? "bg-pa-green text-bg font-bold"
                : "bg-white/4 text-text-secondary hover:text-text-primary"
            }`}
          >
            {opt === "all" ? "Alle" : STATUS_LABEL[opt]}
          </button>
        ))}
      </Card>

      {error && (
        <Card variant="soft" className="p-4 border-error/30 text-error-light">
          {error}
        </Card>
      )}

      {loading ? (
        <Card variant="soft" className="p-8 text-center text-text-secondary">
          Lädt …
        </Card>
      ) : filteredPosts.length === 0 ? (
        <Card variant="soft" className="p-8 text-center text-text-secondary">
          Noch keine News in dieser Ansicht.
        </Card>
      ) : (
        <div className="space-y-2">
          {filteredPosts.map((post) => (
            <Card key={post._id} variant="soft" className="p-4">
              <div className="flex items-start gap-4">
                <div className="w-16 h-16 rounded-[10px] bg-white/4 flex items-center justify-center shrink-0 overflow-hidden">
                  {post.imageId ? (
                    // eslint-disable-next-line @next/next/no-img-element -- admin thumbnail, not LCP
                    <img
                      src={`/api/news/images/${post.imageId}`}
                      alt={post.imageAlt || post.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <ImageIcon className="w-6 h-6 text-text-muted" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <h3 className="text-text-primary font-semibold truncate">
                      {post.title}
                    </h3>
                    <Badge variant={badgeVariantForType(post.type)}>
                      {TYPE_LABEL[post.type]}
                    </Badge>
                    <Badge variant={badgeVariantForStatus(post.status)}>
                      {STATUS_LABEL[post.status]}
                    </Badge>
                  </div>
                  <p className="text-text-secondary text-sm truncate">
                    {post.excerpt || post.slug}
                  </p>
                  <p className="text-text-muted text-xs mt-1">
                    {post.publishedAt
                      ? `Veröffentlicht ${formatDate(post.publishedAt)}`
                      : `Erstellt ${formatDate(post.createdAt)}`}
                  </p>
                </div>

                <div className="flex gap-2 shrink-0">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setView({ kind: "edit", post })}
                  >
                    <Pencil className="w-4 h-4" />
                    Bearbeiten
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => onDelete(post)}
                    aria-label={`"${post.title}" löschen`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

const ERROR_MESSAGES: Record<string, string> = {
  slug_conflict: "Ein Beitrag mit diesem Titel existiert bereits. Bitte den Titel anpassen.",
  title_required: "Titel fehlt.",
  body_required: "Inhalt fehlt.",
  invalid_type: "Ungültiger Typ.",
  invalid_status: "Ungültiger Status.",
  invalid_image_type: "Bildformat nicht unterstützt (PNG, JPG oder WebP).",
  image_too_large: "Bild zu groß (max. 8 MB).",
  not_found: "Eintrag nicht gefunden.",
  forbidden: "Keine Berechtigung.",
  unauthorized: "Sitzung abgelaufen, bitte neu einloggen.",
};

const MAX_IMAGE_SIZE = 8 * 1024 * 1024;

function friendlyError(code: string | undefined): string {
  if (!code) return "Unbekannter Fehler.";
  return ERROR_MESSAGES[code] ?? `Fehler: ${code}`;
}

interface NewsFormProps {
  title: string;
  initial: FormState;
  postId?: string;
  onCancel: () => void;
  onSaved: (post: NewsPost) => void;
}

function NewsForm({ title, initial, postId, onCancel, onSaved }: NewsFormProps) {
  const [form, setForm] = useState<FormState>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isEdit = Boolean(postId);

  useEffect(() => {
    if (!form.imageFile) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(form.imageFile);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [form.imageFile]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");

    if (!form.title.trim()) {
      setError("Titel fehlt.");
      setSaving(false);
      return;
    }
    if (!form.body.trim()) {
      setError("Inhalt fehlt.");
      setSaving(false);
      return;
    }

    try {
      const fd = new FormData();
      fd.append("title", form.title);
      fd.append("body", form.body);
      fd.append("excerpt", form.excerpt);
      fd.append("type", form.type);
      fd.append("status", form.status);
      fd.append("imageAlt", form.imageAlt);
      if (form.imageFile) {
        fd.append("image", form.imageFile);
      }
      if (form.removeImage) {
        fd.append("removeImage", "true");
      }

      const url = isEdit ? `/api/admin/news/${postId}` : "/api/admin/news";
      const method = isEdit ? "PATCH" : "POST";
      const res = await fetch(url, { method, body: fd });
      if (res.status === 401) {
        setError("Sitzung abgelaufen, bitte neu einloggen.");
        return;
      }
      let data: { error?: string; post?: NewsPost } = {};
      try {
        data = await res.json();
      } catch {
        // Non-JSON response (e.g. HTML error page)
      }
      if (!res.ok) {
        setError(friendlyError(data.error));
        return;
      }
      if (data.post) {
        onSaved(data.post);
      }
    } catch {
      setError("Speichern fehlgeschlagen.");
    } finally {
      setSaving(false);
    }
  };

  const showImagePreview =
    previewUrl ||
    (!form.removeImage && form.existingImageId
      ? `/api/news/images/${form.existingImageId}`
      : null);

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-text-primary">{title}</h2>
        </div>
        <Button type="button" variant="secondary" onClick={onCancel}>
          <ArrowLeft className="w-4 h-4" /> Zurück
        </Button>
      </div>

      {error && (
        <Card variant="soft" className="p-4 border border-error/30 text-error-light">
          {error}
        </Card>
      )}

      <Card variant="soft" className="p-6 space-y-4">
        <Input
          label="Titel"
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          maxLength={120}
          required
        />

        <Input
          label="Excerpt (optional, max 280 Zeichen)"
          value={form.excerpt}
          onChange={(e) => setForm({ ...form, excerpt: e.target.value })}
          maxLength={280}
        />

        <div className="flex flex-col gap-1.5">
          <label className="text-text-secondary text-sm font-medium">
            Inhalt (Markdown unterstützt)
          </label>
          <textarea
            value={form.body}
            onChange={(e) => setForm({ ...form, body: e.target.value })}
            rows={10}
            maxLength={10000}
            className="bg-white/3 border border-white/8 text-text-primary rounded-[10px] px-4 py-3 outline-none focus:border-pa-green/35 focus:ring-2 focus:ring-pa-green/6 font-mono text-sm"
            required
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-text-secondary text-sm font-medium">Typ</label>
            <select
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value as NewsType })}
              className="bg-white/3 border border-white/8 text-text-primary rounded-[10px] px-4 py-3 outline-none"
            >
              <option value="release">Release</option>
              <option value="event">Event</option>
              <option value="community">Community</option>
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-text-secondary text-sm font-medium">Status</label>
            <select
              value={form.status}
              onChange={(e) =>
                setForm({ ...form, status: e.target.value as NewsStatus })
              }
              className="bg-white/3 border border-white/8 text-text-primary rounded-[10px] px-4 py-3 outline-none"
            >
              <option value="draft">Entwurf</option>
              <option value="published">Veröffentlicht</option>
            </select>
          </div>
        </div>
      </Card>

      <Card variant="soft" className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-text-primary font-semibold">Bild (optional)</h3>
          {form.existingImageId && !form.removeImage && (
            <Button
              type="button"
              variant="danger"
              size="sm"
              onClick={() =>
                setForm({ ...form, removeImage: true, imageFile: null })
              }
            >
              Bild entfernen
            </Button>
          )}
        </div>

        {showImagePreview && (
          <div className="rounded-[10px] overflow-hidden border border-white/8 bg-black/20 max-w-md">
            {/* eslint-disable-next-line @next/next/no-img-element -- preview supports blob: URLs from local file pick */}
            <img
              src={showImagePreview}
              alt={form.imageAlt || "Vorschau"}
              className="w-full h-auto block"
            />
          </div>
        )}

        <div className="flex items-center gap-3">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={(e) => {
              const file = e.target.files?.[0] ?? null;
              if (file && file.size > MAX_IMAGE_SIZE) {
                setError("Bild zu groß (max. 8 MB).");
                e.target.value = "";
                return;
              }
              setError("");
              setForm({ ...form, imageFile: file, removeImage: false });
            }}
            className="hidden"
          />
          <Button
            type="button"
            variant="secondary"
            onClick={() => fileInputRef.current?.click()}
          >
            {form.imageFile
              ? `Datei: ${form.imageFile.name}`
              : showImagePreview
                ? "Bild ersetzen"
                : "Bild auswählen"}
          </Button>
          {form.imageFile && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setForm({ ...form, imageFile: null })}
            >
              Auswahl verwerfen
            </Button>
          )}
        </div>

        <Input
          label="Alt-Text (Barrierefreiheit)"
          value={form.imageAlt}
          onChange={(e) => setForm({ ...form, imageAlt: e.target.value })}
          maxLength={200}
        />
      </Card>

      <div className="flex items-center gap-3">
        <Button type="submit" loading={saving}>
          {isEdit ? "Speichern" : "Erstellen"}
        </Button>
        <Button type="button" variant="secondary" onClick={onCancel} disabled={saving}>
          Abbrechen
        </Button>
      </div>
    </form>
  );
}
