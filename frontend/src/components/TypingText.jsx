import { useEffect, useState } from 'react';

export default function TypingText({ text, className, speed = 40, showCursor = true }) {
  const [displayedText, setDisplayedText] = useState('');

  useEffect(() => {
    let i = 0;
    setDisplayedText('');
    const timer = setInterval(() => {
      setDisplayedText((prev) => prev + text.charAt(i));
      i++;
      if (i >= text.length) clearInterval(timer);
    }, speed);

    return () => clearInterval(timer);
  }, [text, speed]);

  return (
    <div className={className}>
      {displayedText}
      {showCursor && <span className="typing-cursor">|</span>}
    </div>
  );
}
