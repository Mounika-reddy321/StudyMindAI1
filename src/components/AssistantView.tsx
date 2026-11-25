import React, { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  Atom,
  Calculator,
  Check,
  Code2,
  Copy,
  FileText,
  Globe,
  GraduationCap,
  History,
  Mic,
  MicOff,
  Plus,
  RotateCcw,
  Send,
  Sparkles,
  Square,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { ChatMessage, Conversation, LanguageMode, UserProfile } from '../types';
import { streamChat } from '../services/api';
import { Storage } from '../utils/storage';
import { MarkdownRenderer } from './MarkdownRenderer';

interface AssistantViewProps {
  currentUser: UserProfile;
  currentConversationId: string | null;
  setCurrentConversationId: (id: string | null) => void;
  languageMode: LanguageMode;
  setLanguageMode: (mode: LanguageMode) => void;
  pendingPrompt: string | null;
  onConsumePendingPrompt: () => void;
  onNavigateHistory: () => void;
  onLaunchNotesWithTopic: (topic: string, content: string) => void;
  onLaunchExamWithTopic: (topic: string, sourceNotes?: string) => void;
}

interface SpeechRecognitionEventLike {
  results: {
    [index: number]: {
      [index: number]: {
        transcript: string;
      };
    };
  };
}

interface SpeechRecognitionErrorEventLike {
  error: string;
}

interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onstart: (() => void) | null;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onerror: ((e: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

const STARTER_PROMPTS = [
  {
    icon: Atom,
    category: 'Science',
    prompt: 'Explain Photosynthesis and Cellular Respiration with clear step-by-step analogies.',
  },
  {
    icon: Code2,
    category: 'Programming',
    prompt: 'Write a Python implementation of Binary Search with time complexity explanation.',
  },
  {
    icon: Calculator,
    category: 'Mathematics',
    prompt: 'Help me understand the Pythagorean theorem and where it is applied in navigation.',
  },
  {
    icon: Globe,
    category: 'Telugu Study',
    prompt: 'భారత రాజ్యాంగం ప్రాథమిక హక్కులను సరళమైన తెలుగులో వివరించండి.',
  },
];

export const AssistantView: React.FC<AssistantViewProps> = ({
  currentUser,
  currentConversationId,
  setCurrentConversationId,
  languageMode,
  setLanguageMode,
  pendingPrompt,
  onConsumePendingPrompt,
  onNavigateHistory,
  onLaunchNotesWithTopic,
  onLaunchExamWithTopic,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);

  const bottomRef = useRef<HTMLDivElement | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (currentConversationId) {
      const found = Storage.getConversations(currentUser.id).find(
        (c) => c.id === currentConversationId
      );
      setMessages(found ? found.messages : []);
    } else {
      setMessages([]);
    }
    setError(null);
  }, [currentConversationId, currentUser.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isStreaming]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      window.speechSynthesis?.cancel();
    };
  }, []);

  const persistConversation = (convId: string, msgs: ChatMessage[], titleOverride?: string) => {
    const existing = Storage.getConversations(currentUser.id).find((c) => c.id === convId);
    const title =
      titleOverride || existing?.title || msgs[0]?.content.slice(0, 46) || 'New Study Session';
    const conv: Conversation = {
      id: convId,
      userId: currentUser.id,
      title,
      createdAt: existing?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      messages: msgs,
    };
    Storage.saveConversation(currentUser.id, conv);
  };

  const runAssistantStream = async (historyWithUser: ChatMessage[], forcedConvId?: string) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setIsStreaming(true);
    setError(null);
    setVoiceError(null);

    const convId = forcedConvId || currentConversationId || `conv_${Date.now()}`;
    if (!currentConversationId || forcedConvId) {
      setCurrentConversationId(convId);
    }

    const titleSeed = historyWithUser[0]?.content.slice(0, 46);
    const assistantMsgId = `msg_a_${Date.now()}`;
    const placeholderAssistant: ChatMessage = {
      id: assistantMsgId,
      role: 'assistant',
      content: '',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const withPlaceholder = [...historyWithUser, placeholderAssistant];
    setMessages(withPlaceholder);
    persistConversation(convId, historyWithUser, titleSeed);

    let accumulated = '';
    let receivedFollowUps: string[] = [];

    try {
      await streamChat({
        messages: historyWithUser.map((m) => ({ role: m.role, content: m.content })),
        languageMode,
        signal: controller.signal,
        onChunk: (delta) => {
          accumulated += delta;
          setMessages((prev) =>
            prev.map((m) => (m.id === assistantMsgId ? { ...m, content: accumulated } : m))
          );
        },
        onFollowUps: (followUps) => {
          receivedFollowUps = followUps;
          setMessages((prev) =>
            prev.map((m) => (m.id === assistantMsgId ? { ...m, followUps } : m))
          );
        },
      });

      const finalAssistant: ChatMessage = {
        ...placeholderAssistant,
        content: accumulated || 'I could not generate an answer right now. Please retry.',
        followUps: receivedFollowUps,
      };
      const finalMsgs = [...historyWithUser, finalAssistant];
      setMessages(finalMsgs);
      persistConversation(convId, finalMsgs, titleSeed);
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        if (accumulated.trim()) {
          const stoppedMsgs = [
            ...historyWithUser,
            { ...placeholderAssistant, content: accumulated },
          ];
          setMessages(stoppedMsgs);
          persistConversation(convId, stoppedMsgs, titleSeed);
        } else {
          setMessages(historyWithUser);
        }
      } else {
        setMessages(historyWithUser);
        setError(
          err instanceof Error
            ? err.message
            : 'Unable to reach StudyMind AI right now. Please click Retry.'
        );
      }
    } finally {
      setIsStreaming(false);
    }
  };

  const handleSend = (overrideText?: string, startFresh = false) => {
    const text = (overrideText ?? input).trim();
    if (!text || isStreaming) return;

    const userMsg: ChatMessage = {
      id: `msg_u_${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const baseMessages = startFresh ? [] : messages;
    const nextMessages = [...baseMessages, userMsg];
    setMessages(nextMessages);
    if (!overrideText) setInput('');

    const freshId = startFresh ? `conv_${Date.now()}` : undefined;
    runAssistantStream(nextMessages, freshId);
  };

  useEffect(() => {
    if (pendingPrompt && !isStreaming) {
      const promptToRun = pendingPrompt;
      onConsumePendingPrompt();
      handleSend(promptToRun, true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingPrompt]);

  const handleStopStreaming = () => {
    abortRef.current?.abort();
  };

  const handleNewChat = () => {
    abortRef.current?.abort();
    window.speechSynthesis?.cancel();
    setSpeakingId(null);
    setCurrentConversationId(null);
    setMessages([]);
    setError(null);
    setInput('');
  };

  const handleRetryLast = () => {
    if (messages.length === 0 || isStreaming) return;
    let lastUserIdx = -1;
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'user') {
        lastUserIdx = i;
        break;
      }
    }
    if (lastUserIdx === -1) return;
    const trimmed = messages.slice(0, lastUserIdx + 1);
    setMessages(trimmed);
    runAssistantStream(trimmed);
  };

  const handleCopy = (content: string, id: string) => {
    navigator.clipboard.writeText(content);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1800);
  };

  const handleSpeak = (content: string, id: string) => {
    if (!('speechSynthesis' in window)) {
      setVoiceError('Speech synthesis is not supported in this browser.');
      return;
    }
    if (speakingId === id) {
      window.speechSynthesis.cancel();
      setSpeakingId(null);
      return;
    }
    window.speechSynthesis.cancel();
    setSpeakingId(id);
    const cleaned = content
      .replace(/```[\s\S]*?```/g, 'Code block omitted.')
      .replace(/[*#_~`>]/g, '')
      .slice(0, 1800);
    const utterance = new SpeechSynthesisUtterance(cleaned);
    utterance.rate = 1;
    utterance.pitch = 1;
    utterance.lang = languageMode === 'Telugu' ? 'te-IN' : 'en-US';
    utterance.onend = () => setSpeakingId(null);
    utterance.onerror = () => setSpeakingId(null);
    window.speechSynthesis.speak(utterance);
  };

  const handleVoiceInput = () => {
    const SpeechRec = (
      window as unknown as {
        SpeechRecognition?: new () => SpeechRecognitionLike;
        webkitSpeechRecognition?: new () => SpeechRecognitionLike;
      }
    ).SpeechRecognition ||
      (
        window as unknown as {
          webkitSpeechRecognition?: new () => SpeechRecognitionLike;
        }
      ).webkitSpeechRecognition;

    if (!SpeechRec) {
      setVoiceError('Voice dictation is not supported in this browser. Try Chrome or Edge.');
      return;
    }
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    setVoiceError(null);
    try {
      const rec = new SpeechRec();
      rec.continuous = false;
      rec.interimResults = false;
      rec.lang = languageMode === 'Telugu' ? 'te-IN' : 'en-US';
      rec.onstart = () => setIsListening(true);
      rec.onresult = (evt) => {
        const transcript = evt.results[0][0].transcript;
        setInput((prev) => (prev ? `${prev} ${transcript}` : transcript));
        setIsListening(false);
      };
      rec.onerror = (evt) => {
        setIsListening(false);
        if (evt.error === 'not-allowed') {
          setVoiceError('Microphone access was denied. Please enable it in browser settings.');
        } else {
          setVoiceError(`Voice input error: ${evt.error}. Please try again.`);
        }
      };
      rec.onend = () => setIsListening(false);
      recognitionRef.current = rec;
      rec.start();
    } catch (e) {
      setVoiceError(`Could not start microphone: ${e instanceof Error ? e.message : 'Unknown error'}`);
      setIsListening(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-4.75rem)] max-w-5xl mx-auto px-3 sm:px-6 py-4">
      {/* Control Header Card */}
      <div className="bg-white dark:bg-[#0c1829] rounded-2xl p-4 sm:p-5 border border-sky-100 dark:border-sky-950/80 shadow-xs mb-4 flex flex-col gap-3.5 transition-colors">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-sky-100/80 dark:border-sky-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-950 dark:bg-sky-600 text-white flex items-center justify-center shadow-md shadow-blue-950/20 dark:shadow-sky-600/20 shrink-0">
              <Sparkles className="w-5 h-5 text-sky-400 dark:text-white" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-extrabold text-blue-950 dark:text-white tracking-tight">
                Interactive Study Tutor
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                Live streaming explanations, voice Q&A, and one-click follow-ups.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              type="button"
              onClick={onNavigateHistory}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white dark:bg-[#0a1526] hover:bg-sky-50 dark:hover:bg-sky-950/50 text-blue-950 dark:text-sky-300 border border-sky-200 dark:border-sky-900/60 text-xs font-bold transition-colors cursor-pointer whitespace-nowrap"
            >
              <History className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400 shrink-0" />
              <span>Chat History</span>
            </button>
            <button
              type="button"
              onClick={handleNewChat}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-950 dark:bg-sky-600 hover:bg-sky-600 dark:hover:bg-sky-500 text-white text-xs font-bold shadow-sm transition-colors cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Chat</span>
            </button>
          </div>
        </div>

        {/* Language Mode Selector */}
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 font-semibold">
            <Globe className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400 shrink-0" />
            <span>Response Language</span>
          </div>

          <div className="inline-flex items-center bg-slate-50 dark:bg-[#081220] p-1 rounded-xl border border-sky-100/90 dark:border-sky-950/80 text-xs">
            {(
              [
                { id: 'Simple English', label: 'Simple English' },
                { id: 'Telugu', label: 'తెలుగు' },
                { id: 'Telugu + English', label: 'Telugu + English' },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setLanguageMode(opt.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
                  languageMode === opt.id
                    ? 'bg-blue-950 dark:bg-sky-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-blue-950 dark:hover:text-white hover:bg-sky-100/60 dark:hover:bg-sky-950/50'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Voice Notice */}
      {voiceError && (
        <div className="mb-3 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-xs flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <span>{voiceError}</span>
          </div>
          <button
            type="button"
            onClick={() => setVoiceError(null)}
            className="font-bold px-2 hover:underline cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto space-y-4 px-1 pb-4">
        {messages.length === 0 ? (
          <div className="py-8 flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-sky-100 to-blue-50 dark:from-slate-800 dark:to-slate-900 border border-sky-200 dark:border-sky-900/70 flex items-center justify-center text-blue-950 dark:text-sky-400 mb-4 shadow-xs">
              <Sparkles className="w-7 h-7" />
            </div>
            <h3 className="text-xl sm:text-2xl font-extrabold text-blue-950 dark:text-white tracking-tight max-w-lg text-balance">
              What would you like to master today, {currentUser.displayName.split(' ')[0]}?
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1.5 max-w-md">
              Ask any academic, coding, or competitive exam question in English or Telugu — responses stream live with interactive follow-ups.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-3xl mt-7 text-left">
              {STARTER_PROMPTS.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.category}
                    type="button"
                    onClick={() => handleSend(item.prompt)}
                    className="group p-4 rounded-2xl bg-white dark:bg-[#0c1829] hover:bg-sky-50/60 dark:hover:bg-sky-950/35 border border-sky-100 dark:border-sky-950/80 hover:border-sky-300 dark:hover:border-sky-700 transition-all cursor-pointer flex items-start gap-3 shadow-2xs"
                  >
                    <div className="w-9 h-9 rounded-xl bg-sky-50 dark:bg-[#081220] text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0 group-hover:bg-blue-950 group-hover:text-white dark:group-hover:bg-sky-600 transition-colors">
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold text-sky-700 dark:text-sky-400 mb-0.5">
                        {item.category}
                      </div>
                      <p className="text-xs sm:text-[13px] font-semibold text-slate-700 dark:text-slate-200 leading-snug">
                        {item.prompt}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          messages.map((msg, idx) => {
            const isUser = msg.role === 'user';
            const isLastAssistant = !isUser && idx === messages.length - 1;
            const precedingUser = idx > 0 && messages[idx - 1]?.role === 'user' ? messages[idx - 1].content : '';

            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-[92%] sm:max-w-[85%] rounded-2xl px-4 py-3.5 sm:px-5 sm:py-4 ${
                    isUser
                      ? 'bg-blue-950 dark:bg-sky-600 text-white shadow-sm'
                      : 'bg-white dark:bg-[#0c1829] border border-sky-100 dark:border-sky-950/80 text-slate-800 dark:text-slate-100 shadow-2xs'
                  }`}
                >
                  {isUser ? (
                    <p className="text-sm font-medium whitespace-pre-wrap leading-relaxed">
                      {msg.content}
                    </p>
                  ) : msg.content ? (
                    <MarkdownRenderer content={msg.content} className="text-sm" />
                  ) : (
                    <div className="flex items-center gap-2 text-xs font-semibold text-sky-600 dark:text-sky-400 py-1">
                      <span className="w-4 h-4 rounded-full border-2 border-sky-600 dark:border-sky-400 border-t-transparent animate-spin" />
                      <span>Thinking and crafting your answer...</span>
                    </div>
                  )}

                  {/* Footer Actions */}
                  <div
                    className={`mt-3 pt-2.5 border-t flex flex-wrap items-center justify-between gap-2 text-[11px] ${
                      isUser
                        ? 'border-white/15 text-sky-200'
                        : 'border-slate-100 dark:border-sky-950/80 text-slate-400 dark:text-slate-500'
                    }`}
                  >
                    <span className="tabular-nums">{msg.timestamp}</span>

                    {!isUser && msg.content && (
                      <div className="flex flex-wrap items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleSpeak(msg.content, msg.id)}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-sky-50 dark:hover:bg-sky-950/60 text-slate-600 dark:text-slate-300 hover:text-blue-950 dark:hover:text-white font-semibold transition-colors cursor-pointer"
                          title={speakingId === msg.id ? 'Stop reading' : 'Read aloud'}
                        >
                          {speakingId === msg.id ? (
                            <>
                              <VolumeX className="w-3.5 h-3.5 text-rose-500" />
                              <span>Stop</span>
                            </>
                          ) : (
                            <>
                              <Volume2 className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                              <span>Listen</span>
                            </>
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() => handleCopy(msg.content, msg.id)}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-sky-50 dark:hover:bg-sky-950/60 text-slate-600 dark:text-slate-300 hover:text-blue-950 dark:hover:text-white font-semibold transition-colors cursor-pointer"
                        >
                          {copiedId === msg.id ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-500" />
                              <span>Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              <span>Copy</span>
                            </>
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            onLaunchNotesWithTopic(
                              precedingUser.slice(0, 70) || 'Study Session Notes',
                              msg.content
                            )
                          }
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-sky-50 dark:hover:bg-sky-950/60 text-sky-700 dark:text-sky-400 font-semibold transition-colors cursor-pointer"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          <span>Make Notes</span>
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            onLaunchExamWithTopic(
                              precedingUser.slice(0, 70) || 'Topic Mastery Quiz',
                              msg.content
                            )
                          }
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-sky-50 dark:hover:bg-sky-950/60 text-sky-700 dark:text-sky-400 font-semibold transition-colors cursor-pointer"
                        >
                          <GraduationCap className="w-3.5 h-3.5" />
                          <span>Quiz Me</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Clickable Interactive Follow-up Suggestions */}
                {isLastAssistant && !isStreaming && msg.followUps && msg.followUps.length > 0 && (
                  <div className="mt-2.5 flex flex-wrap gap-2 max-w-[92%] sm:max-w-[85%]">
                    {msg.followUps.map((q, fIdx) => (
                      <button
                        key={fIdx}
                        type="button"
                        onClick={() => handleSend(q)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-[#0c1829] hover:bg-sky-50 dark:hover:bg-sky-950/60 text-blue-950 dark:text-sky-300 border border-sky-200/90 dark:border-sky-900/70 text-xs font-semibold transition-colors cursor-pointer text-left"
                      >
                        <span>{q}</span>
                        <ArrowRight className="w-3 h-3 text-sky-600 dark:text-sky-400 shrink-0" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}

        {/* Error Box with Retry */}
        {error && (
          <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/80 text-rose-800 dark:text-rose-200 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
              <p className="font-medium leading-relaxed">{error}</p>
            </div>
            <button
              type="button"
              onClick={handleRetryLast}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold shrink-0 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Retry Question</span>
            </button>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Composer */}
      <div className="bg-white dark:bg-[#0c1829] rounded-2xl p-2.5 sm:p-3 border border-sky-200/90 dark:border-sky-950/90 shadow-sm transition-colors">
        <div className="flex items-end gap-2">
          <button
            type="button"
            onClick={handleVoiceInput}
            title={isListening ? 'Stop voice dictation' : 'Dictate question by voice'}
            aria-label={isListening ? 'Stop voice dictation' : 'Dictate question by voice'}
            className={`p-2.5 rounded-xl border transition-colors shrink-0 cursor-pointer ${
              isListening
                ? 'bg-rose-600 text-white border-rose-600'
                : 'bg-slate-50 dark:bg-[#081220] text-slate-600 dark:text-slate-300 border-slate-200 dark:border-sky-950 hover:text-sky-600 dark:hover:text-sky-400'
            }`}
          >
            {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>

          <textarea
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              languageMode === 'Telugu'
                ? 'మీ సందేహాన్ని తెలుగులో లేదా ఇంగ్లీష్‌లో అడగండి...'
                : 'Ask a study question, paste a problem, or request a step-by-step explanation...'
            }
            className="flex-1 resize-none max-h-36 px-3 py-2.5 bg-transparent text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-hidden font-medium"
          />

          {isStreaming ? (
            <button
              type="button"
              onClick={handleStopStreaming}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-colors shrink-0 cursor-pointer"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
              <span>Stop</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => handleSend()}
              disabled={!input.trim()}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-blue-950 dark:bg-sky-600 hover:bg-sky-600 dark:hover:bg-sky-500 disabled:opacity-45 disabled:cursor-not-allowed text-white text-xs font-bold transition-colors shrink-0 cursor-pointer"
            >
              <span>Send</span>
              <Send className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
