import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Check, Copy } from 'lucide-react';

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content, className = '' }) => {
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 1800);
  };

  return (
    <div className={`study-prose text-slate-700 dark:text-slate-200 ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          pre({ children }) {
            let codeText = '';
            if (React.isValidElement<{ children?: React.ReactNode }>(children)) {
              const raw = children.props?.children;
              if (typeof raw === 'string') codeText = raw;
              else if (Array.isArray(raw)) codeText = raw.join('');
            }
            return (
              <div className="relative group my-3">
                {codeText && (
                  <button
                    type="button"
                    onClick={() => handleCopyCode(codeText)}
                    className="absolute right-2.5 top-2.5 inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-800 hover:bg-sky-700 text-slate-200 text-[11px] font-semibold transition-colors cursor-pointer"
                    title="Copy code"
                  >
                    {copiedCode === codeText ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-400" />
                        <span>Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                )}
                <pre>{children}</pre>
              </div>
            );
          },
          a({ href, children }) {
            return (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sky-600 dark:text-sky-400 underline underline-offset-2 hover:text-blue-950 dark:hover:text-sky-300 font-medium"
              >
                {children}
              </a>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};
