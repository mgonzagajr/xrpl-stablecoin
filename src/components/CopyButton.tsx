import { useState } from 'react';

interface CopyButtonProps {
  text: string;
  className?: string;
}

export function CopyButton({ text, className = '' }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy text:', error);
    }
  };

  return (
    <button
      onClick={handleCopy}
      className={`px-2 py-1 text-xs rounded transition-colors cursor-pointer ${
        copied
          ? 'bg-green-100 text-green-800 border border-green-300'
          : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-300'
      } ${className}`}
      title={copied ? 'Copied!' : 'Copy to clipboard'}
    >
      {copied ? 'Copied!' : 'Copy'}
    </button>
  );
}
