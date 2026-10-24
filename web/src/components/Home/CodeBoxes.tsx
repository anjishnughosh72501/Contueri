import React, { useRef } from 'react';
import { ROOM_CODE_LENGTH, sanitizeRoomCode } from '@contueri/shared';

interface CodeBoxesProps {
  value: string;
  onChange: (code: string) => void;
  onSubmit?: () => void;
}

export const CodeBoxes: React.FC<CodeBoxesProps> = ({ value, onChange, onSubmit }) => {
  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);

  const chars = Array.from({ length: ROOM_CODE_LENGTH }, (_, i) => value[i] || '');

  const handleChange = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const sanitized = sanitizeRoomCode(raw);

    if (sanitized.length > 1) {
      // Pasted or typed multiple characters
      handlePasteString(sanitized);
      return;
    }

    const nextChars = [...chars];
    nextChars[index] = sanitized;
    const nextCode = nextChars.join('').slice(0, ROOM_CODE_LENGTH);
    onChange(nextCode);

    if (sanitized && index < ROOM_CODE_LENGTH - 1) {
      inputsRef.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !chars[index] && index > 0) {
      inputsRef.current[index - 1]?.focus();
    } else if (e.key === 'Enter') {
      if (onSubmit && value.length === ROOM_CODE_LENGTH) {
        onSubmit();
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      inputsRef.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < ROOM_CODE_LENGTH - 1) {
      inputsRef.current[index + 1]?.focus();
    }
  };

  const handlePasteString = (pasted: string) => {
    // Check if pasted contains /r/CODE link
    const linkMatch = pasted.match(/\/r\/([A-Za-z0-9]+)/i);
    const extract = linkMatch ? linkMatch[1] : pasted;
    const clean = sanitizeRoomCode(extract).slice(0, ROOM_CODE_LENGTH);
    onChange(clean);
    const targetIdx = Math.min(clean.length, ROOM_CODE_LENGTH - 1);
    inputsRef.current[targetIdx]?.focus();
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text');
    handlePasteString(text);
  };

  return (
    <div className="code-inputs-container" onPaste={handlePaste} role="group" aria-label="6-character room code">
      {Array.from({ length: ROOM_CODE_LENGTH }).map((_, idx) => (
        <input
          key={idx}
          ref={(el) => (inputsRef.current[idx] = el)}
          type="text"
          inputMode="text"
          maxLength={ROOM_CODE_LENGTH}
          value={chars[idx]}
          onChange={(e) => handleChange(idx, e)}
          onKeyDown={(e) => handleKeyDown(idx, e)}
          className="code-digit-input"
          aria-label={`Digit ${idx + 1} of room code`}
          autoComplete="off"
        />
      ))}
    </div>
  );
};
