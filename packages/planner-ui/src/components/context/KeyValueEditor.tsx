import { useState, useCallback } from 'react';
import { CloseIcon, PlusIcon } from '../icons';

interface KeyValueEditorProps {
  fields: Record<string, unknown>;
  onChange: (fields: Record<string, unknown>) => void;
  isEditable: boolean;
  fieldHints?: Record<string, string>;
}

export function KeyValueEditor({
  fields,
  onChange,
  isEditable,
  fieldHints = {},
}: KeyValueEditorProps) {
  const [editingKey, setEditingKey] = useState<string | null>(null);

  const handleAddField = useCallback(() => {
    const newKey = '';
    const newFields = { ...fields, [newKey]: '' };
    onChange(newFields);
    setEditingKey(newKey);
  }, [fields, onChange]);

  const handleDeleteField = useCallback(
    (key: string) => {
      const newFields = { ...fields };
      delete newFields[key];
      onChange(newFields);
    },
    [fields, onChange]
  );

  const handleKeyChange = useCallback(
    (oldKey: string, newKey: string) => {
      if (oldKey === newKey) return;

      // Don't allow duplicate keys
      if (newKey in fields && oldKey !== newKey) {
        return;
      }

      const newFields: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(fields)) {
        if (k === oldKey) {
          newFields[newKey] = v;
        } else {
          newFields[k] = v;
        }
      }
      onChange(newFields);
      setEditingKey(null);
    },
    [fields, onChange]
  );

  const handleValueChange = useCallback(
    (key: string, value: unknown) => {
      const newFields = { ...fields, [key]: value };
      onChange(newFields);
    },
    [fields, onChange]
  );

  const formatValue = (value: unknown): string => {
    if (typeof value === 'string') return value;
    if (Array.isArray(value)) {
      // If array contains objects, JSON.stringify the whole array
      if (value.length > 0 && typeof value[0] === 'object' && value[0] !== null) {
        return JSON.stringify(value, null, 2);
      }
      // Simple array of primitives - join with commas
      return value.join(', ');
    }
    if (typeof value === 'object' && value !== null) return JSON.stringify(value, null, 2);
    return String(value);
  };

  const entries = Object.entries(fields);

  if (entries.length === 0 && !isEditable) {
    return (
      <div className="px-4 py-6 text-center text-text-muted text-sm italic">
        No fields defined
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {entries.length > 0 && (
        <table className="w-full text-sm">
          <tbody>
            {entries.map(([key, value]) => {
              const hint = fieldHints[key];
              const isEditingThisKey = editingKey === key;

              return (
                <tr
                  key={key}
                  className="group border-b border-border-subtle last:border-b-0 hover:bg-bg-tertiary/50 transition-colors"
                >
                  {/* Key cell */}
                  <td className="py-2.5 pr-4 align-top w-1/4 min-w-[120px]">
                    {isEditable && isEditingThisKey ? (
                      <input
                        type="text"
                        value={key}
                        onChange={(e) => handleKeyChange(key, e.target.value)}
                        onBlur={() => setEditingKey(null)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === 'Escape') {
                            e.preventDefault();
                            setEditingKey(null);
                          }
                        }}
                        autoFocus
                        className="w-full px-2 py-1 bg-bg-secondary border border-accent-cyan rounded text-text-primary text-sm focus:outline-none"
                        placeholder="key"
                      />
                    ) : (
                      <span
                        className={`text-text-secondary font-medium ${
                          isEditable ? 'cursor-pointer hover:text-accent-cyan' : ''
                        }`}
                        onClick={() => isEditable && setEditingKey(key)}
                        title={hint}
                      >
                        {key || <span className="text-text-muted italic">empty</span>}
                      </span>
                    )}
                  </td>

                  {/* Value cell */}
                  <td className="py-2.5 align-top">
                    {isEditable ? (
                      <textarea
                        value={formatValue(value)}
                        onChange={(e) => handleValueChange(key, e.target.value)}
                        className="w-full px-2 py-1 bg-transparent border-0 text-text-primary text-sm placeholder:text-text-muted focus:outline-none focus:bg-bg-secondary focus:rounded resize-none overflow-hidden"
                        placeholder="value"
                        rows={1}
                        onInput={(e) => {
                          const target = e.target as HTMLTextAreaElement;
                          target.style.height = 'auto';
                          target.style.height = `${target.scrollHeight}px`;
                        }}
                      />
                    ) : (
                      <span className="text-text-primary whitespace-pre-wrap">
                        {formatValue(value)}
                      </span>
                    )}
                  </td>

                  {/* Delete cell */}
                  {isEditable && (
                    <td className="py-2.5 pl-2 align-top w-8">
                      <button
                        type="button"
                        className="p-1 text-text-muted hover:text-error opacity-0 group-hover:opacity-100 transition-all"
                        onClick={() => handleDeleteField(key)}
                        title="Delete field"
                      >
                        <CloseIcon size="xs" />
                      </button>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {/* Add field button */}
      {isEditable && (
        <button
          type="button"
          className="inline-flex items-center gap-1.5 px-2 py-1 text-xs text-accent-cyan hover:bg-accent-cyan/10 rounded transition-colors"
          onClick={handleAddField}
        >
          <PlusIcon size="xs" />
          Add field
        </button>
      )}
    </div>
  );
}
