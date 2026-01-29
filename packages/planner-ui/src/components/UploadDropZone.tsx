/**
 * UploadDropZone - Drag-drop file upload area with visual states.
 *
 * States: idle, dragover, hasFile
 * Accepts: .md, .txt, .yaml, .yml, .json files
 */

import { useRef, useState, useCallback } from 'react';

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
      // Reset input so same file can be selected again
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

  const getStateClass = () => {
    if (file) return 'upload-drop-zone--has-file';
    if (isDragOver) return 'upload-drop-zone--dragover';
    return '';
  };

  return (
    <div
      className={`upload-drop-zone ${getStateClass()}`.trim()}
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
        style={{ display: 'none' }}
        disabled={disabled}
      />

      {file ? (
        <div className="upload-file-info">
          <span className="upload-file-icon">📄</span>
          <span className="upload-file-name">{file.name}</span>
          <span className="upload-file-size">{formatFileSize(file.size)}</span>
          <button
            type="button"
            className="upload-file-remove"
            onClick={(e) => {
              e.stopPropagation();
              onClear();
            }}
            aria-label={`Remove file: ${file.name}`}
          >
            ×
          </button>
        </div>
      ) : isDragOver ? (
        <>
          <div className="upload-zone-icon">📥</div>
          <div className="upload-zone-text">Drop file to upload</div>
        </>
      ) : (
        <>
          <div className="upload-zone-icon">📤</div>
          <div className="upload-zone-text">Drop your document here or click to browse</div>
          <div className="upload-zone-hint" id="upload-hint">
            .md, .txt, .yaml, .json
          </div>
        </>
      )}

      {error && (
        <div className="error-message" style={{ marginTop: 'var(--spacing-sm)' }}>
          {error}
        </div>
      )}
    </div>
  );
}
