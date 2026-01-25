'use client';

import { useCallback, useState, useEffect } from 'react';
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
  maxSize = 10 * 1024 * 1024,
  label = 'Upload Image',
  hint = 'PNG, JPG, GIF up to 10MB',
  disabled = false,
  className,
  preview = true,
}: DropzoneProps) {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const processFile = useCallback(
    (newFile: File) => {
      if (newFile.size > maxSize) {
        setError('File is too large. Maximum size is ' + (maxSize / 1024 / 1024) + 'MB');
        return false;
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const extension = newFile.type.split('/')[1] || 'png';
      const processedFile = new File(
        [newFile],
        newFile.name || 'pasted-image-' + timestamp + '.' + extension,
        { type: newFile.type }
      );

      setFile(processedFile);
      setError(null);

      if (preview) {
        const url = URL.createObjectURL(processedFile);
        setPreviewUrl(url);
      }

      onFileAccepted(processedFile);
      return true;
    },
    [maxSize, preview, onFileAccepted]
  );

  const onDrop = useCallback(
    (acceptedFiles: File[], rejectedFiles: FileRejection[]) => {
      setError(null);

      if (rejectedFiles.length > 0) {
        const rejection = rejectedFiles[0];
        if (rejection.errors[0]?.code === 'file-too-large') {
          setError('File is too large. Maximum size is ' + (maxSize / 1024 / 1024) + 'MB');
        } else if (rejection.errors[0]?.code === 'file-invalid-type') {
          setError('Invalid file type. Please upload an image.');
        } else {
          setError(rejection.errors[0]?.message || 'Invalid file');
        }
        return;
      }

      if (acceptedFiles.length > 0) {
        processFile(acceptedFiles[0]);
      }
    },
    [maxSize, processFile]
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

  // Global paste listener - works anywhere on the page without clicking
  useEffect(() => {
    if (disabled || file) return;

    const handleGlobalPaste = (event: ClipboardEvent) => {
      const target = event.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      const items = event.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.startsWith('image/')) {
          event.preventDefault();
          const pastedFile = item.getAsFile();
          if (pastedFile) {
            processFile(pastedFile);
          }
          return;
        }
      }
    };

    document.addEventListener('paste', handleGlobalPaste);
    return () => document.removeEventListener('paste', handleGlobalPaste);
  }, [disabled, file, processFile]);

  const { getRootProps, getInputProps, isDragActive, isDragReject } =
    useDropzone({
      onDrop,
      accept,
      maxSize,
      disabled,
      multiple: false,
    });

  return (
    <div className={cn('w-full', className)}>
      {!file ? (
        <div className="space-y-3">
          <div
            {...getRootProps()}
            className={cn(
              'relative border-2 border-dashed rounded-xl p-6 transition-all duration-200 cursor-pointer',
              'flex flex-col items-center justify-center text-center',
              isDragActive && !isDragReject && 'border-primary-500 bg-primary-50 dark:bg-primary-950/50',
              isDragReject && 'border-danger-500 bg-danger-50 dark:bg-danger-950/50',
              !isDragActive && !isDragReject && 'border-slate-300 hover:border-primary-400 hover:bg-slate-50 dark:border-slate-600 dark:hover:border-primary-500 dark:hover:bg-slate-800/50',
              disabled && 'opacity-50 cursor-not-allowed',
              error && 'border-danger-300 bg-danger-50 dark:border-danger-500 dark:bg-danger-950/50'
            )}
          >
            <input {...getInputProps()} />

            <div
              className={cn(
                'w-14 h-14 rounded-full flex items-center justify-center mb-3',
                isDragActive && !isDragReject && 'bg-primary-100 dark:bg-primary-900/50',
                isDragReject && 'bg-danger-100 dark:bg-danger-900/50',
                !isDragActive && !isDragReject && 'bg-slate-100 dark:bg-slate-700'
              )}
            >
              {isDragReject ? (
                <AlertCircle className="w-7 h-7 text-danger-500" />
              ) : (
                <Upload className={cn('w-7 h-7', isDragActive ? 'text-primary-500' : 'text-slate-400 dark:text-slate-500')} />
              )}
            </div>

            <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {isDragReject ? 'Invalid file type' : isDragActive ? 'Drop the file here' : label}
            </p>

            <p className="text-xs text-slate-500 dark:text-slate-400">
              {isDragActive ? 'Release to upload' : hint}
            </p>
          </div>

          <div className={cn(
            'flex items-center justify-center gap-2 px-4 py-3 rounded-lg transition-all',
            'bg-gradient-to-r from-primary-50 to-primary-100 border border-primary-200',
            'dark:from-primary-950/50 dark:to-primary-900/50 dark:border-primary-800',
            disabled && 'opacity-50'
          )}>
            <Clipboard className="w-5 h-5 text-primary-600 dark:text-primary-400" />
            <div className="text-center">
              <p className="text-sm font-medium text-primary-700 dark:text-primary-300">Paste Screenshot Anywhere</p>
              <p className="text-xs text-primary-600 dark:text-primary-400">
                Press <kbd className="px-1.5 py-0.5 bg-white dark:bg-slate-700 rounded border border-primary-300 dark:border-primary-600 font-mono text-xs">Ctrl</kbd> + <kbd className="px-1.5 py-0.5 bg-white dark:bg-slate-700 rounded border border-primary-300 dark:border-primary-600 font-mono text-xs">V</kbd> to paste
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="relative border-2 border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden bg-white dark:bg-slate-800">
          {preview && previewUrl && (
            <div className="aspect-video relative bg-slate-100 dark:bg-slate-900">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={previewUrl} alt="Preview" className="w-full h-full object-contain" />
            </div>
          )}

          <div className="p-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-lg bg-primary-100 dark:bg-primary-900/50 flex items-center justify-center flex-shrink-0">
                <ImageIcon className="w-5 h-5 text-primary-600 dark:text-primary-400" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">{file.name}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">{(file.size / 1024).toFixed(1)} KB</p>
              </div>
            </div>

            <button
              type="button"
              onClick={removeFile}
              disabled={disabled}
              className={cn(
                'p-2 rounded-lg transition-colors',
                'text-slate-400 hover:text-danger-600 hover:bg-danger-50 dark:hover:bg-danger-950/50',
                disabled && 'opacity-50 cursor-not-allowed'
              )}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {error && (
        <p className="mt-2 text-sm text-danger-600 dark:text-danger-400 flex items-center gap-1.5">
          <AlertCircle className="w-4 h-4" />
          {error}
        </p>
      )}
    </div>
  );
}
