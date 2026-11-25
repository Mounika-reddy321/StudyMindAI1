import React, { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, Loader2, MessageSquare, Send, Sparkles, X } from 'lucide-react';
import { ActiveStudyContext, LanguageMode } from '../types';
import { streamChat } from '../services/api';
import { MarkdownRenderer } from './MarkdownRenderer';

interface FloatingTutorDrawerProps {
  context: ActiveStudyContext | null;
  languageMode: LanguageMode;
  onExpandToAssistant: (prompt: string) => void;
}

interface QuickMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

export const FloatingTutorDrawer: React.FC<FloatingTutorDrawerProps> = ({
  context,
  languageMode,
  onExpandToAssistant,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<QuickMessage[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isOpen]);

  const quickChips = context
    ? [
        `Summarize "${context.title.slice(0, 32)}" in 3 points`,
        `Give me a quick 1-question quiz on this`,
        `Explain the key takeaway simply`,
      ]
    : [
        'Help me plan a 30-minute study sprint',
        'Quiz me on Indian Polity basics',
        'Explain a coding concept simply',
      ];

  const handleSend = async (override?: string) => {
    const text = (override ?? input).trim();
    if (!text || streaming) return;

    const userMsg: QuickMessage = { id: `q_u_${Date.now()}`, role: 'user', content: text };
    const assistantId = `q_a_${Date.now()}`;
    const history = [...messages, userMsg];

    setMessages([...history, { id: assistantId, role: 'assistant', content: '' }]);
    if (!override) setInput('');
    setStreaming(true);
    setError(null);

    let acc = '';
    try {
      await streamChat({
        messages: history.map((m) => ({ role: m.role, content: m.content })),
        languageMode,
        context,
        onChunk: (delta) => {
          acc += delta;
          setMessages((prev) =>
            prev.map((m) => (m.id === assistantId ? { ...m, content: acc } : m))
          );
        },
      });
    } catch (err) {
      setMessages(history);
      setError(err instanceof Error ? err.message : 'Quick Tutor failed to respond.');
    } finally {
      setStreaming(false);
    }
  };

  return (
    <>
      {!isOpen && (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="fixed bottom-5 right-5 z-40 inline-flex items-center gap-2 px-4 py-3 rounded-2xl bg-blue-950 dark:bg-sky-600 hover:bg-sky-600 dark:hover:bg-sky-500 text-white text-xs font-extrabold shadow-lg shadow-blue-950/25 dark:shadow-sky-600/30 transition-all cursor-pointer"
        >
          <Sparkles className="w-4 h-4 text-sky-300 dark:text-white" />
          <span>Ask StudyMind AI</span>
        </button>
      )}

      {isOpen && (
        <div className="fixed bottom-5 right-5 z-50 w-[calc(100vw-2.5rem)] sm:w-[400px] h-[520px] max-h-[80vh] bg-white dark:bg-[#0c1829] rounded-2xl border border-sky-200 dark:border-sky-900 shadow-2xl flex flex-col overflow-hidden">
          {/* Header */}
          <div className="px-4 py-3.5 bg-blue-950 dark:bg-[#070f1c] text-white flex items-center justify-between gap-2 border-b border-sky-900/50">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-sky-500/20 flex items-center justify-center shrink-0">
                <MessageSquare className="w-4 h-4 text-sky-300" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-extrabold truncate">Quick Study Companion</p>
                <p className="text-[11px] text-sky-300 truncate">
                  {context ? `Context: ${context.title}` : 'Always ready to help'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              {messages.length > 0 && (
                <button
                  type="button"
                  title="Open in full AI Assistant"
                  onClick={() => {
                    const lastUser = [...messages].reverse().find((m) => m.role === 'user');
                    setIsOpen(false);
                    onExpandToAssistant(
                      lastUser
                        ? lastUser.content
                        : `Help me understand ${context?.title || 'my current study topic'}`
                    );
                  }}
                  className="p-1.5 rounded-lg text-sky-200 hover:bg-white/10 transition-colors cursor-pointer"
                >
                  <ArrowUpRight className="w-4 h-4" />
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                aria-label="Close Quick Companion"
                className="p-1.5 rounded-lg text-sky-200 hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-3.5 space-y-3 bg-[#f0f6fa]/60 dark:bg-[#060d17]">
            {messages.length === 0 ? (
              <div className="py-4 space-y-3">
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  I can see what you are studying right now. Ask any quick doubt without leaving this page:
                </p>
                <div className="space-y-2">
                  {quickChips.map((chip, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleSend(chip)}
                      className="w-full text-left px-3 py-2 rounded-xl bg-white dark:bg-[#0c1829] hover:bg-sky-50 dark:hover:bg-sky-950/60 border border-sky-100 dark:border-sky-950 text-xs font-semibold text-blue-950 dark:text-sky-300 transition-colors cursor-pointer"
                    >
                      {chip}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((m) => (
                <div
                  key={m.id}
                  className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 text-xs ${
                      m.role === 'user'
                        ? 'bg-blue-950 dark:bg-sky-600 text-white font-medium'
                        : 'bg-white dark:bg-[#0c1829] border border-sky-100 dark:border-sky-950 text-slate-800 dark:text-slate-100'
                    }`}
                  >
                    {m.role === 'user' ? (
                      m.content
                    ) : m.content ? (
                      <MarkdownRenderer content={m.content} className="text-xs" />
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-sky-600 dark:text-sky-400 font-semibold">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Thinking...
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
            {error && (
              <p className="text-xs font-semibold text-rose-600 dark:text-rose-400">{error}</p>
            )}
            <div ref={endRef} />
          </div>

          {/* Input */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="p-2.5 bg-white dark:bg-[#0c1829] border-t border-sky-100 dark:border-sky-950 flex items-center gap-2"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask a quick study question..."
              className="flex-1 px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#081220] border border-slate-200 dark:border-sky-950 text-xs text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-sky-400/30 font-medium"
            />
            <button
              type="submit"
              disabled={!input.trim() || streaming}
              aria-label="Send quick question"
              className="p-2 rounded-xl bg-blue-950 dark:bg-sky-600 hover:bg-sky-600 dark:hover:bg-sky-500 disabled:opacity-45 text-white transition-colors cursor-pointer shrink-0"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      )}
    </>
  );
};
