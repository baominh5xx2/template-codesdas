"use client";

import { useId, useRef, useState, type ReactNode } from "react";
import { Button, Icon, cx } from "../primitives";

export function Field({ label, hint, error, optional, children, htmlFor }: { label: ReactNode; hint?: ReactNode; error?: string; optional?: boolean; children: ReactNode; htmlFor?: string }) {
  return <div className="vn-field">
    <label className="vn-label" htmlFor={htmlFor}><span>{label}</span>{optional ? <span className="vn-caption" style={{ fontWeight: 500 }}>Không bắt buộc</span> : null}</label>
    {children}
    {error ? <span className="vn-hint" role="alert" style={{ color: "var(--vn-flag-red)", fontWeight: 600 }}>{error}</span> : hint ? <span className="vn-hint">{hint}</span> : null}
  </div>;
}

export type UploadedFile = { name: string; size: number; type: string };
const formatSize = (bytes: number) => bytes >= 1_048_576 ? `${(bytes / 1_048_576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;

/**
 * Drag-and-drop file picker. Only file metadata leaves this component: upload/ingestion is a
 * platform capability that is not wired yet, so files are never read or sent.
 */
export function FileDrop({ accept, multiple, label, hint, files, onChange, maxBytes = 20 * 1_048_576 }: { accept: string; multiple?: boolean; label: string; hint: string; files: UploadedFile[]; onChange: (files: UploadedFile[]) => void; maxBytes?: number }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const id = useId();
  const allowed = accept.split(",").map(ext => ext.trim().toLowerCase());
  const take = (list: FileList | null) => {
    if (!list) return;
    const picked = [...list];
    const wrongType = picked.find(file => !allowed.some(ext => file.name.toLowerCase().endsWith(ext)));
    const tooBig = picked.find(file => file.size > maxBytes);
    if (wrongType) { setError(`“${wrongType.name}” không đúng định dạng (${accept}).`); return; }
    if (tooBig) { setError(`“${tooBig.name}” vượt quá ${formatSize(maxBytes)}.`); return; }
    setError(null);
    const next = picked.map(file => ({ name: file.name, size: file.size, type: file.type }));
    onChange(multiple ? [...files, ...next] : next.slice(0, 1));
  };
  return <div className="vn-stack vn-stack--s">
    <label htmlFor={id} className={cx("vn-dropzone", dragging && "is-dragging")}
      onDragOver={event => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)}
      onDrop={event => { event.preventDefault(); setDragging(false); take(event.dataTransfer.files); }}>
      <span className="vn-dropzone__icon"><Icon name="upload" size={22} /></span>
      <strong className="vn-strong">{label}</strong>
      <span className="vn-hint">{hint}</span>
      <input ref={inputRef} id={id} type="file" accept={accept} multiple={multiple} className="vn-sr-only" onChange={event => { take(event.target.files); event.target.value = ""; }} />
    </label>
    {error ? <span className="vn-hint" role="alert" style={{ color: "var(--vn-flag-red)", fontWeight: 600 }}>{error}</span> : null}
    {files.map((file, index) => <div key={`${file.name}-${index}`} className="vn-file-pill">
      <span className="vn-row" style={{ gap: 8, minWidth: 0 }}><Icon name="file-text" size={16} style={{ color: "var(--vn-blue)" }} /><span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{file.name}</span><span className="vn-caption">{formatSize(file.size)}</span></span>
      <button type="button" className="vn-icon-btn vn-icon-btn--s" aria-label={`Bỏ ${file.name}`} onClick={() => onChange(files.filter((_, i) => i !== index))}><Icon name="x" size={14} /></button>
    </div>)}
  </div>;
}

/** Editable list of http(s) URLs. */
export function UrlList({ value, onChange, placeholder = "https://…", max = 8 }: { value: string[]; onChange: (urls: string[]) => void; placeholder?: string; max?: number }) {
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const add = () => {
    const url = draft.trim();
    if (!url) return;
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") throw new Error("protocol");
    } catch { setError("Chỉ nhận liên kết http:// hoặc https:// hợp lệ."); return; }
    if (value.includes(url)) { setError("Liên kết đã có trong danh sách."); return; }
    if (value.length >= max) { setError(`Tối đa ${max} liên kết.`); return; }
    onChange([...value, url]); setDraft(""); setError(null);
  };
  return <div className="vn-stack vn-stack--s">
    <div className="vn-row" style={{ flexWrap: "nowrap", gap: 8 }}>
      <input className="vn-input" type="url" value={draft} placeholder={placeholder} onChange={event => setDraft(event.target.value)} onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); add(); } }} aria-label="Thêm liên kết" />
      <Button variant="secondary" iconLeft="plus" onClick={add} aria-label="Thêm liên kết">Thêm</Button>
    </div>
    {error ? <span className="vn-hint" role="alert" style={{ color: "var(--vn-flag-red)", fontWeight: 600 }}>{error}</span> : null}
    {value.map(url => <div key={url} className="vn-file-pill">
      <span className="vn-row" style={{ gap: 8, minWidth: 0 }}><Icon name="link" size={16} style={{ color: "var(--vn-blue)" }} /><span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{url}</span></span>
      <button type="button" className="vn-icon-btn vn-icon-btn--s" aria-label={`Bỏ ${url}`} onClick={() => onChange(value.filter(item => item !== url))}><Icon name="x" size={14} /></button>
    </div>)}
  </div>;
}

export function Segmented<T extends string>({ options, value, onChange, label }: { options: Array<{ value: T; label: string }>; value: T; onChange: (value: T) => void; label: string }) {
  return <div className="vn-segmented" role="radiogroup" aria-label={label}>
    {options.map(option => <button key={option.value} type="button" role="radio" aria-checked={value === option.value} className={value === option.value ? "is-active" : undefined} onClick={() => onChange(option.value)}>{option.label}</button>)}
  </div>;
}
