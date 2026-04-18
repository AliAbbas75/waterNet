import { useRef } from 'react';

export default function OTPInput({ value, onChange }) {
  const refs = useRef([]);

  const handleChange = (index, nextValue) => {
    const digit = nextValue.replace(/\D/g, '').slice(-1);
    const chars = value.split('');
    while (chars.length < 6) chars.push('');
    chars[index] = digit;
    onChange(chars.join('').slice(0, 6));
    if (digit && index < 5) {
      refs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index, event) => {
    if (event.key === 'Backspace' && !value[index] && index > 0) {
      refs.current[index - 1]?.focus();
    }
  };

  return (
    <div className="otp-grid">
      {Array.from({ length: 6 }).map((_, index) => (
        <input
          key={index}
          ref={(node) => {
            refs.current[index] = node;
          }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={value[index] ?? ''}
          onChange={(event) => handleChange(index, event.target.value)}
          onKeyDown={(event) => handleKeyDown(index, event)}
          className="otp-box"
          aria-label={`Verification digit ${index + 1}`}
        />
      ))}
    </div>
  );
}
