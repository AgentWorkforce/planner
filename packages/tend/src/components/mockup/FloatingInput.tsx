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
      <div className="bg-white rounded-xl border border-[#e0dbd3] shadow-md focus-within:ring-2 focus-within:ring-[#4a7c59]/30 focus-within:border-[#4a7c59] transition-all">
        <textarea
          className="w-full h-20 px-4 py-3 resize-none bg-transparent text-[#2d2d2d] text-sm placeholder:text-[#9a9a9a] focus:outline-none"
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
