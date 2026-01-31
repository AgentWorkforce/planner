/**
 * DocumentImportForm - Complete document import flow.
 *
 * States: input (upload/paste) → analyzing → preview → creating
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { DocumentTextarea } from './DocumentTextarea';
import { UploadDropZone } from './UploadDropZone';
import {
  FormatDetectionBadge,
  detectFormatFromContent,
  type DocumentFormat,
} from './FormatDetectionBadge';
import { ExtractionPreview, type ExtractedStep, type ExtractedScope } from './ExtractionPreview';
import { LoadingSpinner } from './LoadingSpinner';
import { importDocument, createPlanFromImport, ApiError } from '@/api';

type FormState = 'input' | 'analyzing' | 'preview' | 'creating';

interface UploadedFile {
  name: string;
  size: number;
  content: string;
}

interface ExtractionResult {
  format: DocumentFormat;
  confidence: 'high' | 'medium' | 'low';
  scopes: ExtractedScope[];
  suggestedGoal?: string;
  suggestedContext?: string;
  filename?: string;
  charCount?: number;
}

export function DocumentImportForm() {
  const navigate = useNavigate();
  const [state, setState] = useState<FormState>('input');
  const [content, setContent] = useState('');
  const [file, setFile] = useState<UploadedFile | null>(null);
  const [detectedFormat, setDetectedFormat] = useState<{
    format: DocumentFormat;
    confidence: 'high' | 'medium' | 'low';
  } | null>(null);
  const [extractionResult, setExtractionResult] = useState<ExtractionResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced format detection when content changes
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (!content.trim()) {
      setDetectedFormat(null);
      return;
    }

    debounceRef.current = setTimeout(() => {
      const detected = detectFormatFromContent(content);
      setDetectedFormat(detected);
    }, 500);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [content]);

  const handleFileContent = useCallback((fileContent: string, filename: string) => {
    setContent(fileContent);
    setFile({
      name: filename,
      size: new Blob([fileContent]).size,
      content: fileContent,
    });
    setError(null);
  }, []);

  const handleClearFile = useCallback(() => {
    setFile(null);
    setContent('');
    setDetectedFormat(null);
    setError(null);
  }, []);

  const handleContentChange = useCallback((newContent: string) => {
    setContent(newContent);
    setError(null);
    // If user types, clear file association
    if (file && newContent !== file.content) {
      setFile(null);
    }
  }, [file]);

  const handleExtract = async () => {
    if (!content.trim()) {
      setError('Please paste or upload document content');
      return;
    }

    setState('analyzing');
    setError(null);

    try {
      const response = await importDocument(content, {
        filename: file?.name,
        formatHint: detectedFormat?.format,
      });

      // Convert API response to extraction result format
      const result: ExtractionResult = {
        format: response.format,
        confidence: response.confidence,
        scopes: response.scopes.map((scope) => ({
          id: scope.id,
          name: scope.name,
          steps: scope.steps.map((step) => ({
            step_id: step.step_id,
            title: step.title,
            description: step.description,
            scope: scope.name,
          })),
        })),
        suggestedGoal: response.suggestedGoal,
        suggestedContext: response.suggestedContext,
        filename: file?.name,
        charCount: content.length,
      };

      setExtractionResult(result);
      setState('preview');
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Failed to analyze document');
      }
      setState('input');
    }
  };

  const handleBackToInput = () => {
    setState('input');
  };

  const handleCreatePlan = async (goal: string, steps: ExtractedStep[]) => {
    setState('creating');
    setError(null);

    try {
      const response = await createPlanFromImport({
        goal,
        context: extractionResult?.suggestedContext,
        steps: steps.map((step) => ({
          title: step.title,
          description: step.description,
          scope: step.scope,
        })),
        source: {
          filename: file?.name,
          format: extractionResult?.format,
        },
      });

      navigate(`/plans/${response.plan.plan_id}`);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Failed to create plan');
      }
      setState('preview');
    }
  };

  const handleCancel = () => {
    navigate('/plans');
  };

  // Show loading overlay for analyzing/creating states
  if (state === 'analyzing') {
    return (
      <div className="space-y-6">
        <div className="relative min-h-[300px] flex items-center justify-center">
          <LoadingSpinner message="Analyzing document structure..." />
        </div>
      </div>
    );
  }

  // Show extraction preview (for both preview and creating states)
  if ((state === 'preview' || state === 'creating') && extractionResult) {
    return (
      <div className="relative">
        {state === 'creating' && (
          <div className="absolute inset-0 bg-bg-deep/80 backdrop-blur-sm z-10 flex items-center justify-center rounded-xl">
            <LoadingSpinner message="Creating plan..." />
          </div>
        )}
        <ExtractionPreview
          result={extractionResult}
          onResultChange={setExtractionResult}
          onBack={handleBackToInput}
          onCreatePlan={handleCreatePlan}
          onCancel={handleCancel}
          loading={state === 'creating'}
        />
      </div>
    );
  }

  // Input state - show upload and textarea
  return (
    <div className="space-y-6">
      {error && (
        <div className="px-4 py-3 bg-error/10 border border-error/30 rounded-lg text-error text-sm">
          {error}
        </div>
      )}

      <UploadDropZone
        onFileContent={handleFileContent}
        file={file}
        onClear={handleClearFile}
      />

      <div className="flex items-center gap-4 text-text-muted">
        <div className="flex-1 h-px bg-text-dim/30" />
        <span className="text-sm">or paste content below</span>
        <div className="flex-1 h-px bg-text-dim/30" />
      </div>

      <DocumentTextarea
        value={content}
        onChange={handleContentChange}
        placeholder="Paste your PRD, spec, or document content here..."
        rows={12}
      />

      <div className="flex items-center justify-between">
        <div>
          {detectedFormat && content.trim() && (
            <FormatDetectionBadge
              format={detectedFormat.format}
              confidence={detectedFormat.confidence}
            />
          )}
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            className="px-4 py-2 bg-bg-tertiary text-text-primary font-medium rounded-lg hover:bg-bg-hover transition-colors"
            onClick={handleCancel}
          >
            Cancel
          </button>
          <button
            type="button"
            className="px-4 py-2 bg-accent-cyan text-bg-deep font-medium rounded-lg hover:bg-accent-cyan/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={handleExtract}
            disabled={!content.trim()}
          >
            Extract Structure
          </button>
        </div>
      </div>
    </div>
  );
}
