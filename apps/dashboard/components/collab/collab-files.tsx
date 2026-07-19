"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Upload, FileText, Image, Archive, Trash2, Download, FolderIcon } from "lucide-react";
import { useYjs } from "./yjs-provider";
import { useDashboardSession } from "@/app/components/dashboard-session";
import { getPublicWorkerUrl } from "@/lib/worker-url-client";
import { cn } from "@/lib/utils";

const WORKER_URL = getPublicWorkerUrl();

interface CollabFile {
  id: string; name: string; path: string; mime_type: string;
  size_bytes: number; created_by: string; created_at: string;
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileIcon(mime: string) {
  if (mime.startsWith("image/")) return <Image className="h-4 w-4 text-blue-500" />;
  if (mime.includes("zip") || mime.includes("rar") || mime.includes("tar")) return <Archive className="h-4 w-4 text-amber-500" />;
  if (mime.includes("pdf") || mime.includes("text") || mime.includes("document")) return <FileText className="h-4 w-4 text-indigo-500" />;
  return <FileText className="h-4 w-4 text-muted-foreground" />;
}

export default function CollabFiles({ roomId }: { roomId: string }) {
  const { adminJwt, memberJwt } = useDashboardSession();
  const token = adminJwt.trim() || memberJwt.trim();
  const [files, setFiles] = useState<CollabFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadFiles = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${WORKER_URL}/collab/files?roomId=${encodeURIComponent(roomId)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setFiles(data.files || []);
    } catch { /* ignore */ }
    setLoading(false);
  }, [roomId, token]);

  useEffect(() => { loadFiles(); }, [loadFiles]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !token) return;
    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    try {
      await fetch(`${WORKER_URL}/collab/files/upload?roomId=${encodeURIComponent(roomId)}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      await loadFiles();
    } catch { /* ignore */ }
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleDelete = async (fileId: string) => {
    if (!token) return;
    try {
      await fetch(`${WORKER_URL}/collab/files/${fileId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      setFiles((prev) => prev.filter((f) => f.id !== fileId));
    } catch { /* ignore */ }
  };

  const handleDownload = (file: CollabFile) => {
    if (!token) return;
    const url = `${WORKER_URL}/collab/files/download/${file.id}?token=${encodeURIComponent(token)}`;
    window.open(url, "_blank");
  };

  return (
    <div className="flex h-full flex-col bg-white dark:bg-gray-900">
      <div className="flex items-center justify-between border-b px-4 py-2">
        <h3 className="text-xs font-semibold text-muted-foreground">{files.length} file{files.length !== 1 ? "s" : ""}</h3>
        <div className="flex items-center gap-2">
          <input ref={fileInputRef} type="file" className="hidden" onChange={handleUpload} />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            <Upload className="h-3.5 w-3.5" />
            {uploading ? "Uploading..." : "Upload"}
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        {loading && <p className="py-8 text-center text-xs text-muted-foreground">Loading files...</p>}
        {!loading && files.length === 0 && (
          <p className="py-8 text-center text-xs text-muted-foreground">No files yet. Upload one to get started.</p>
        )}
        <div className="space-y-1">
          {files.map((file) => (
            <div key={file.id} className="group flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-muted/50">
              {fileIcon(file.mime_type)}
              <div className="flex-1 min-w-0">
                <p className="truncate text-sm font-medium">{file.name}</p>
                <p className="text-[10px] text-muted-foreground">{formatSize(file.size_bytes)} · {new Date(file.created_at).toLocaleDateString()}</p>
              </div>
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => handleDownload(file)} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted"><Download className="h-3.5 w-3.5" /></button>
                <button onClick={() => handleDelete(file.id)} className="rounded-md p-1.5 text-muted-foreground hover:bg-red-50 hover:text-red-500"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
