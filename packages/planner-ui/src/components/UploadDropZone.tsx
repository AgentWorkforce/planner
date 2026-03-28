/**
 * UploadDropZone - Drag-drop file upload area with visual states.
 *
 * States: idle, dragover, hasFile
 * Accepts: .md, .txt, .yaml, .yml, .json files
 */

import { useRef, useState, useCallback } from 'react';
import { CloseIcon } from './icons';

interface UploadedFile {
  name: string;
  size: number;
  content: string;
}

interface UploadDropZoneProps {
  onFileContent: (content: string, filename: string) => void;
  file: UploadedFile | null;
  onClear: () => void;
  disabled?: boolean;
}

const ACCEPTED_EXTENSIONS = ['.md', '.txt', '.yaml', '.yml', '.json'];
const ACCEPTED_MIME_TYPES = [
  'text/plain',
  'text/markdown',
  'text/x-markdown',
  'text/yaml',
  'text/x-yaml',
  'application/x-yaml',
  'application/json',
];

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isAcceptedFile(file: File): boolean {
  const ext = '.' + file.name.split('.').pop()?.toLowerCase();
  return ACCEPTED_EXTENSIONS.includes(ext) || ACCEPTED_MIME_TYPES.includes(file.type);
}

// Simple file icons using SVG
function FileIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14,2 14,8 20,8" />
    </svg>
  );
}

function UploadIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="32"
      height="32"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17,8 12,3 7,8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  );
}

function DownloadIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="32"
      height="32"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7,10 12,15 17,10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

export function UploadDropZone({
  onFileContent,
  file,
  onClear,
  disabled = false,
}: UploadDropZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = useCallback(
    async (selectedFile: File) => {
      setError(null);

      if (!isAcceptedFile(selectedFile)) {
        setError('Please upload a .md, .txt, .yaml, .yml, or .json file');
        return;
      }

      try {
        const content = await selectedFile.text();
        onFileContent(content, selectedFile.name);
      } catch {
        setError('Failed to read file');
      }
    },
    [onFileContent]
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!disabled) {
        setIsDragOver(true);
      }
    },
    [disabled]
  );

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);

      if (disabled) return;

      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile) {
        handleFile(droppedFile);
      }
    },
    [disabled, handleFile]
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFile = e.target.files?.[0];
      if (selectedFile) {
        handleFile(selectedFile);
      }
      e.target.value = '';
    },
    [handleFile]
  );

  const handleClick = () => {
    if (!disabled && !file) {
      inputRef.current?.click();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.key === 'Enter' || e.key === ' ') && !disabled && !file) {
      e.preventDefault();
      inputRef.current?.click();
    }
  };

  return (
    <div
      className={`relative border-2 border-dashed rounded-xl p-6 text-center transition-colors cursor-pointer ${
        file
          ? 'border-success bg-success/5'
          : isDragOver
          ? 'border-accent-cyan bg-accent-cyan/5'
          : 'border-border-subtle bg-bg-secondary hover:border-accent-cyan/50'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-describedby="upload-hint"
      aria-disabled={disabled}
    >
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_EXTENSIONS.join(',')}
        onChange={handleInputChange}
        className="hidden"
        disabled={disabled}
      />

      {file ? (
        <div className="flex items-center justify-center gap-3">
          <FileIcon className="text-success" />
          <span className="font-medium text-text-primary">{file.name}</span>
          <span className="text-sm text-text-muted">{formatFileSize(file.size)}</span>
          <button
            type="button"
            className="p-1 text-text-muted hover:text-error transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              onClear();
            }}
            aria-label={`Remove file: ${file.name}`}
          >
            <CloseIcon size="md" />
          </button>
        </div>
      ) : isDragOver ? (
        <div className="flex flex-col items-center gap-2">
          <DownloadIcon className="text-accent-cyan" />
          <div className="text-text-primary font-medium">Drop file to upload</div>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2">
          <UploadIcon className="text-text-muted" />
          <div className="text-text-primary font-medium">Drop your document here or click to browse</div>
          <div className="text-sm text-text-muted" id="upload-hint">
            .md, .txt, .yaml, .json
          </div>
        </div>
      )}

      {error && (
        <div className="mt-3 p-2 bg-error/10 border border-error/30 rounded text-error text-sm">
          {error}
        </div>
      )}
    </div>
  );
}
