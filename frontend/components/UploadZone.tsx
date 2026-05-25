"use client";

import { Camera, FileImage, UploadCloud, X } from "lucide-react";
import { useRef, useState } from "react";

type UploadZoneProps = {
  file: File | null;
  onFile: (file: File | null) => void;
};

export function UploadZone({ file, onFile }: UploadZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  return (
    <div
      className={`panel flex min-h-56 flex-col items-center justify-center border-dashed p-6 text-center transition ${
        dragging ? "border-primary bg-primary/10" : "border-white/15"
      }`}
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        onFile(event.dataTransfer.files?.[0] ?? null);
      }}
    >
      <input
        ref={inputRef}
        className="hidden"
        type="file"
        accept="image/jpeg,image/png,image/heic,image/heif"
        capture="environment"
        onChange={(event) => onFile(event.target.files?.[0] ?? null)}
      />
      {file ? (
        <>
          <FileImage className="h-10 w-10 text-success" />
          <p className="mt-3 text-base font-semibold">{file.name}</p>
          <p className="mt-1 text-sm text-slate-400">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
          <button
            type="button"
            className="mt-5 inline-flex items-center gap-2 rounded-lg border border-white/10 px-4 py-2 text-sm font-semibold"
            onClick={() => onFile(null)}
          >
            <X className="h-4 w-4" />
            Remove
          </button>
        </>
      ) : (
        <>
          <UploadCloud className="h-12 w-12 text-primary" />
          <p className="mt-4 text-lg font-bold">Drag paper photo here</p>
          <p className="mt-1 text-sm text-slate-400">JPG, PNG, HEIC up to 10MB</p>
          <button
            type="button"
            className="mt-5 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-white"
            onClick={() => inputRef.current?.click()}
          >
            <Camera className="h-4 w-4" />
            Choose or take photo
          </button>
        </>
      )}
    </div>
  );
}
