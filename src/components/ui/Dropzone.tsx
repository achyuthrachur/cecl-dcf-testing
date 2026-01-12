'use client';

import { useCallback, useState, useEffect, useRef } from 'react';
import { useDropzone, FileRejection } from 'react-dropzone';
import { cn } from '@/lib/utils';
import { Upload, Image as ImageIcon, X, AlertCircle, Clipboard } from 'lucide-react';

interface DropzoneProps {
  onFileAccepted: (file: File) => void;
  onFileRemoved?: () => void;
  accept?: Record<string, string[]>;
  maxSize?: number;
  label?: string;
  hint?: string;
  disabled?: boolean;
  className?: string;
  preview?: boolean;
}

export function Dropzone({
  onFileAccepted,
  onFileRemoved,
  accept = {
    'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.webp'],
  },
  maxSize = 10 * 1024 * 1024, // 10MB
  label = 'Upload Image',
  hint = 'PNG, JPG, GIF up to 10MB',
  disabled = false,
  className,
  preview = true,
}: DropzoneProps) {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onDrop = useCallback(
    (acceptedFiles: File[], rejectedFiles: FileRejection[]) => {
      setError(null);

      if (rejectedFiles.length > 0) {
        const rejection = rejectedFiles[0];
        if (rejection.errors[0]?.code === 'file-too-large') {
          setError(`File is too large. Maximum size is ${maxSize / 1024 / 1024}MB`);
        } else if (rejection.errors[0]?.code === 'file-invalid-type') {
          setError('Invalid file type. Please upload an image.');
        } else {
          setError(rejection.errors[0]?.message || 'Invalid file');
        }
        return;
      }

      if (acceptedFiles.length > 0) {
        const acceptedFile = acceptedFiles[0];
        setFile(acceptedFile);

        if (preview) {
          const url = URL.createObjectURL(acceptedFile);
          setPreviewUrl(url);
        }

        onFileAccepted(acceptedFile);
      }
    },
    [maxSize, preview, onFileAccepted]
  );

  const removeFile = useCallback(() => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setFile(null);
    setPreviewUrl(null);
    setError(null);
    onFileRemoved?.();
  }, [previewUrl, onFileRemoved]);

  const dropzoneRef = useRef<HTMLDivElement>(null);

  const handlePaste = useCallback(
    (event: ClipboardEvent) => {
      if (disabled || file) return;

      const items = event.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.startsWith('image/')) {
          event.preventDefault();
          const pastedFile = item.getAsFile();
          if (pastedFile) {
            // Validate file size
            if (pastedFile.size > maxSize) {
              setError(`File is too large. Maximum size is ${maxSize / 1024 / 1024}MB`);
              return;
            }

            // Create a new file with a proper name for pasted images
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const extension = pastedFile.type.split('/')[1] || 'png';
            const namedFile = new File(
              [pastedFile],
              `pasted-image-${timestamp}.${extension}`,
              { type: pastedFile.type }
            );

            setFile(namedFile);
            setError(null);

            if (preview) {
              const url = URL.createObjectURL(namedFile);
              setPreviewUrl(url);
            }

            onFileAccepted(namedFile);
          }
          return;
        }
      }
    },
    [disabled, file, maxSize, preview, onFileAccepted]
  );

  // Listen for paste events when the dropzone is focused or globally when no file is present
  useEffect(() => {
    const handleGlobalPaste = (event: ClipboardEvent) => {
      // Only handle paste if the dropzone area is focused or hovered
      const activeElement = document.activeElement;
      const dropzoneElement = dropzoneRef.current;

      if (dropzoneElement?.contains(activeElement) || dropzoneElement?.matches(':hover')) {
        handlePaste(event);
      }
    };

    document.addEventListener('paste', handleGlobalPaste);
    return () => {
      document.removeEventListener('paste', handleGlobalPaste);
    };
  }, [handlePaste]);

  const { getRootProps, getInputProps, isDragActive, isDragReject } =
    useDropzone({
      onDrop,
      accept,
      maxSize,
      disabled,
      multiple: false,
    });

  return (
    <div className={cn('w-full', className)} ref={dropzoneRef} tabIndex={0}>
      {!file ? (
        <div
          {...getRootProps()}
          className={cn(
            'relative border-2 border-dashed rounded-xl p-8 transition-all duration-200 cursor-pointer',
            'flex flex-col items-center justify-center text-center',
            isDragActive && !isDragReject && 'border-primary-500 bg-primary-50',
            isDragReject && 'border-danger-500 bg-danger-50',
            !isDragActive &&
              !isDragReject &&
              'border-slate-300 hover:border-primary-400 hover:bg-slate-50',
            disabled && 'opacity-50 cursor-not-allowed',
            error && 'border-danger-300 bg-danger-50'
          )}
        >
          <input {...getInputProps()} />

          <div
            className={cn(
              'w-14 h-14 rounded-full flex items-center justify-center mb-4',
              isDragActive && !isDragReject && 'bg-primary-100',
              isDragReject && 'bg-danger-100',
              !isDragActive && !isDragReject && 'bg-slate-100'
            )}
          >
            {isDragReject ? (
              <AlertCircle className="w-7 h-7 text-danger-500" />
            ) : (
              <Upload
                className={cn(
                  'w-7 h-7',
                  isDragActive ? 'text-primary-500' : 'text-slate-400'
                )}
              />
            )}
          </div>

          <p className="text-sm font-medium text-slate-700 mb-1">
            {isDragReject
              ? 'Invalid file type'
              : isDragActive
                ? 'Drop the file here'
                : label}
          </p>

          <p className="text-xs text-slate-500">
            {isDragActive ? 'Release to upload' : hint}
          </p>

          {!isDragActive && (
            <p className="text-xs text-slate-400 mt-2 flex items-center gap-1">
              <Clipboard className="w-3 h-3" />
              Or paste from clipboard (Ctrl+V)
            </p>
          )}
        </div>
      ) : (
        <div className="relative border-2 border-slate-200 rounded-xl overflow-hidden bg-white">
          {preview && previewUrl && (
            <div className="aspect-video relative bg-slate-100">
              <img
                src={previewUrl}
                alt="Preview"
                className="w-full h-full object-contain"
              />
            </div>
          )}

          <div className="p-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-lg bg-primary-100 flex items-center justify-center flex-shrink-0">
                <ImageIcon className="w-5 h-5 text-primary-600" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-900 truncate">
                  {file.name}
                </p>
                <p className="text-xs text-slate-500">
                  {(file.size / 1024).toFixed(1)} KB
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={removeFile}
              disabled={disabled}
              className={cn(
                'p-2 rounded-lg transition-colors',
                'text-slate-400 hover:text-danger-600 hover:bg-danger-50',
                disabled && 'opacity-50 cursor-not-allowed'
              )}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {error && (
        <p className="mt-2 text-sm text-danger-600 flex items-center gap-1.5">
          <AlertCircle className="w-4 h-4" />
          {error}
        </p>
      )}
    </div>
  );
}
