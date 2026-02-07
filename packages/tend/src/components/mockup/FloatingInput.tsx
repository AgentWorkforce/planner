import { useState } from 'react';

interface FloatingInputProps {
  onSend: (text: string) => void;
}

export function FloatingInput({ onSend }: FloatingInputProps) {
  const [value, setValue] = useState('');

  const handleSend = () => {
    if (!value.trim()) return;
    onSend(value);
    setValue('');
  };

  return (
    <div className="absolute bottom-4 left-4 right-4">
      <div className="bg-white rounded-xl border border-[var(--color-bg-tertiary)] shadow-md focus-within:ring-2 focus-within:ring-[var(--color-moss)]/30 focus-within:border-[var(--color-moss)] transition-all">
        <textarea
          className="w-full h-20 px-4 py-3 resize-none bg-transparent text-[var(--color-text-primary)] text-sm placeholder:text-[var(--color-text-muted)] focus:outline-none"
          placeholder="Describe your idea..."
          rows={3}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              handleSend();
            }
          }}
        />
      </div>
    </div>
  );
}
