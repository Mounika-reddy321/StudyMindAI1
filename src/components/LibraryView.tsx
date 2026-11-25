import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  BookOpen,
  Bookmark,
  CheckCircle2,
  ChevronLeft,
  HelpCircle,
  Languages,
  Loader2,
  Pause,
  Play,
  Plus,
  Search,
  Send,
  Sparkles,
  Square,
  Volume2,
  X,
  XCircle,
} from 'lucide-react';
import storiesJson from '../data/stories.json';
import { ActiveStudyContext, ExamQuestion, LanguageMode, Story, UserProfile } from '../types';
import { interactWithStory } from '../services/api';
import { Storage } from '../utils/storage';
import { MarkdownRenderer } from './MarkdownRenderer';

const BASE_STORIES = storiesJson as Story[];

interface LibraryViewProps {
  currentUser: UserProfile;
  languageMode: LanguageMode;
  onCustomStoriesChange: (count: number) => void;
  onContextChange: (ctx: ActiveStudyContext | null) => void;
}

export const LibraryView: React.FC<LibraryViewProps> = ({
  currentUser,
  languageMode,
  onCustomStoriesChange,
  onContextChange,
}) => {
  const [customStories, setCustomStories] = useState<Story[]>(() =>
    Storage.getCustomStories(currentUser.id)
  );
  const [bookmarks, setBookmarks] = useState<number[]>(() =>
    Storage.getBookmarkedStoryIds(currentUser.id)
  );
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeStory, setActiveStory] = useState<Story | null>(null);

  // Audio playback state
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [playbackRate, setPlaybackRate] = useState<number>(1);
  const [fontSize, setFontSize] = useState<'sm' | 'base' | 'lg'>('base');

  // Interactive Story AI Companion state
  const [aiMode, setAiMode] = useState<'none' | 'translate' | 'vocabulary' | 'quiz' | 'ask'>('none');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiOutput, setAiOutput] = useState<string | null>(null);
  const [storyQuiz, setStoryQuiz] = useState<ExamQuestion[]>([]);
  const [quizAnswers, setQuizAnswers] = useState<Record<number, number>>({});
  const [storyQuestion, setStoryQuestion] = useState('');

  // Custom Story Creator modal state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [customTheme, setCustomTheme] = useState('');
  const [customLanguage, setCustomLanguage] = useState<LanguageMode>('Simple English');
  const [creatingStory, setCreatingStory] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const allStories = useMemo(() => [...customStories, ...BASE_STORIES], [customStories]);

  const categories = useMemo(() => {
    const base = [
      'All',
      'Bookmarked',
      'Love Stories',
      'Moral Stories',
      'Women Empowerment',
      'Inspirational & Life',
      'Telugu Kathalu, Family & Mystery',
    ];
    if (customStories.length > 0) base.splice(2, 0, 'My AI Stories');
    return base;
  }, [customStories.length]);

  useEffect(() => {
    setCustomStories(Storage.getCustomStories(currentUser.id));
    setBookmarks(Storage.getBookmarkedStoryIds(currentUser.id));
  }, [currentUser.id]);

  useEffect(() => {
    onCustomStoriesChange(allStories.length);
  }, [allStories.length, onCustomStoriesChange]);

  useEffect(() => {
    if (activeStory) {
      onContextChange({
        source: 'Audio Book Library',
        title: activeStory.title,
        summary: `${activeStory.content}\nMoral: ${activeStory.moral}`,
      });
    } else {
      onContextChange({
        source: 'Audio Book Library',
        title: '100+ Audio Stories Catalog',
        summary: 'Student is browsing stories across Love Stories, Moral Stories, Women Empowerment, Inspirational & Life, and Telugu Kathalu.',
      });
    }
  }, [activeStory, onContextChange]);

  useEffect(() => {
    return () => {
      window.speechSynthesis?.cancel();
    };
  }, []);

  const stopAudio = () => {
    window.speechSynthesis?.cancel();
    setIsPlaying(false);
    setIsPaused(false);
  };

  const openStory = (story: Story) => {
    stopAudio();
    setActiveStory(story);
    setAiMode('none');
    setAiOutput(null);
    setAiError(null);
    setStoryQuiz([]);
    setQuizAnswers({});
    setStoryQuestion('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handlePlay = (rateOverride?: number) => {
    if (!activeStory || !('speechSynthesis' in window)) return;
    if (isPaused && rateOverride === undefined) {
      window.speechSynthesis.resume();
      setIsPaused(false);
      setIsPlaying(true);
      return;
    }
    window.speechSynthesis.cancel();
    const textToRead = `${activeStory.title}. ${activeStory.content}. Moral of the story: ${activeStory.moral}`;
    const utterance = new SpeechSynthesisUtterance(textToRead);
    utterance.rate = rateOverride ?? playbackRate;
    utterance.lang = activeStory.language.toLowerCase().includes('telugu') ? 'te-IN' : 'en-US';
    utterance.onend = () => {
      setIsPlaying(false);
      setIsPaused(false);
    };
    utterance.onerror = () => {
      setIsPlaying(false);
      setIsPaused(false);
    };
    setIsPlaying(true);
    setIsPaused(false);
    window.speechSynthesis.speak(utterance);
  };

  const handlePause = () => {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.pause();
    setIsPlaying(false);
    setIsPaused(true);
  };

  const handleChangeSpeed = (rate: number) => {
    setPlaybackRate(rate);
    if (isPlaying || isPaused) {
      handlePlay(rate);
    }
  };

  const handleToggleBookmark = (storyId: number, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const next = Storage.toggleBookmarkStory(currentUser.id, storyId);
    setBookmarks(next);
  };

  const runStoryAI = async (
    action: 'translate' | 'quiz' | 'vocabulary' | 'ask',
    questionOverride?: string
  ) => {
    if (!activeStory) return;
    setAiMode(action);
    setAiLoading(true);
    setAiError(null);
    if (action !== 'quiz') setAiOutput(null);
    if (action === 'quiz') {
      setStoryQuiz([]);
      setQuizAnswers({});
    }

    try {
      const res = await interactWithStory({
        action,
        story: activeStory,
        languageMode,
        question: questionOverride || storyQuestion,
      });
      if (action === 'quiz') {
        setStoryQuiz(res.questions || []);
      } else {
        setAiOutput(res.reply || 'No response received.');
      }
      if (action === 'ask') setStoryQuestion('');
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'Story AI failed.');
    } finally {
      setAiLoading(false);
    }
  };

  const handleCreateCustomStory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customTheme.trim() || creatingStory) return;
    setCreatingStory(true);
    setCreateError(null);

    try {
      const res = await interactWithStory({
        action: 'create',
        customTheme: customTheme.trim(),
        customLanguage,
      });
      if (!res.story) throw new Error('Story generation returned empty content.');

      const newStory: Story = {
        ...res.story,
        id: Date.now(),
        isCustom: true,
      };
      Storage.saveCustomStory(currentUser.id, newStory);
      setCustomStories(Storage.getCustomStories(currentUser.id));
      setCustomTheme('');
      setIsCreateOpen(false);
      openStory(newStory);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create story.');
    } finally {
      setCreatingStory(false);
    }
  };

  const filteredStories = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return allStories.filter((story) => {
      if (selectedCategory === 'Bookmarked' && !bookmarks.includes(story.id)) return false;
      if (selectedCategory === 'My AI Stories' && !story.isCustom) return false;
      if (
        selectedCategory !== 'All' &&
        selectedCategory !== 'Bookmarked' &&
        selectedCategory !== 'My AI Stories' &&
        story.category !== selectedCategory
      ) {
        return false;
      }
      if (!q) return true;
      return (
        story.title.toLowerCase().includes(q) ||
        story.shortDescription.toLowerCase().includes(q) ||
        story.category.toLowerCase().includes(q) ||
        story.tags.some((t) => t.toLowerCase().includes(q))
      );
    });
  }, [allStories, bookmarks, selectedCategory, searchQuery]);

  // Reader View
  if (activeStory) {
    const isBookmarked = bookmarks.includes(activeStory.id);
    const proseSizeClass =
      fontSize === 'sm' ? 'text-sm leading-relaxed' : fontSize === 'lg' ? 'text-lg leading-loose' : 'text-[15.5px] leading-relaxed';

    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => {
              stopAudio();
              setActiveStory(null);
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white dark:bg-[#0c1829] hover:bg-sky-50 dark:hover:bg-sky-950/60 text-blue-950 dark:text-sky-300 border border-sky-100 dark:border-sky-950 text-xs font-bold transition-colors cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Back to Library</span>
          </button>

          <button
            type="button"
            onClick={() => handleToggleBookmark(activeStory.id)}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border text-xs font-bold transition-colors cursor-pointer ${
              isBookmarked
                ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                : 'bg-white dark:bg-[#0c1829] text-slate-600 dark:text-slate-300 border-sky-100 dark:border-sky-950 hover:text-blue-950 dark:hover:text-white'
            }`}
          >
            <Bookmark className={`w-3.5 h-3.5 ${isBookmarked ? 'fill-current' : ''}`} />
            <span>{isBookmarked ? 'Saved' : 'Save Story'}</span>
          </button>
        </div>

        {/* Story Card */}
        <article className="bg-white dark:bg-[#0c1829] rounded-3xl p-6 sm:p-8 border border-sky-100 dark:border-sky-950/80 shadow-sm space-y-6">
          <div className="space-y-2 pb-5 border-b border-sky-100 dark:border-sky-950/80">
            <div className="flex flex-wrap items-center gap-2 text-xs text-sky-700 dark:text-sky-400 font-semibold">
              <span>{activeStory.category}</span>
              <span aria-hidden="true">·</span>
              <span>{activeStory.language}</span>
              <span aria-hidden="true">·</span>
              <span>{activeStory.readingTime}</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-blue-950 dark:text-white tracking-tight text-balance">
              {activeStory.title}
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {activeStory.shortDescription}
            </p>
          </div>

          {/* Audio Playback & Typography Controls */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-2xl bg-sky-50/70 dark:bg-[#081220] border border-sky-100 dark:border-sky-950/80">
            <div className="flex flex-wrap items-center gap-2">
              {isPlaying ? (
                <button
                  type="button"
                  onClick={handlePause}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition-colors cursor-pointer"
                >
                  <Pause className="w-3.5 h-3.5 fill-current" />
                  <span>Pause</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => handlePlay()}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-950 dark:bg-sky-600 hover:bg-sky-600 dark:hover:bg-sky-500 text-white text-xs font-bold transition-colors cursor-pointer"
                >
                  <Play className="w-3.5 h-3.5 fill-current text-sky-300 dark:text-white" />
                  <span>{isPaused ? 'Resume Audio' : 'Listen Aloud'}</span>
                </button>
              )}

              {(isPlaying || isPaused) && (
                <button
                  type="button"
                  onClick={stopAudio}
                  title="Stop Audio"
                  aria-label="Stop Audio"
                  className="p-2 rounded-xl bg-white dark:bg-[#0c1829] hover:bg-rose-50 dark:hover:bg-rose-950/50 text-rose-600 dark:text-rose-400 border border-sky-100 dark:border-sky-950 transition-colors cursor-pointer"
                >
                  <Square className="w-3.5 h-3.5 fill-current" />
                </button>
              )}

              <div className="flex items-center gap-1 pl-2 border-l border-sky-200 dark:border-sky-900/60 text-xs font-bold text-slate-600 dark:text-slate-400">
                {[0.9, 1, 1.25].map((speed) => (
                  <button
                    key={speed}
                    type="button"
                    onClick={() => handleChangeSpeed(speed)}
                    className={`px-2 py-1 rounded-lg cursor-pointer transition-colors tabular-nums ${
                      playbackRate === speed
                        ? 'bg-blue-950 dark:bg-sky-600 text-white'
                        : 'hover:text-blue-950 dark:hover:text-white'
                    }`}
                  >
                    {speed}x
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-1">
              {(
                [
                  { id: 'sm', label: 'A-' },
                  { id: 'base', label: 'A' },
                  { id: 'lg', label: 'A+' },
                ] as const
              ).map((sz) => (
                <button
                  key={sz.id}
                  type="button"
                  onClick={() => setFontSize(sz.id)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                    fontSize === sz.id
                      ? 'bg-sky-200 dark:bg-sky-700 text-blue-950 dark:text-white'
                      : 'text-slate-500 dark:text-slate-400 hover:text-blue-950 dark:hover:text-white'
                  }`}
                >
                  {sz.label}
                </button>
              ))}
            </div>
          </div>

          {/* Story Body */}
          <div className={`space-y-4 text-slate-700 dark:text-slate-200 ${proseSizeClass}`}>
            {activeStory.content
              .split(/\n+/)
              .filter(Boolean)
              .map((para, i) => (
                <p key={i}>{para}</p>
              ))}
          </div>

          {/* Moral Box */}
          <div className="p-4 sm:p-5 rounded-2xl bg-sky-50/70 dark:bg-[#081220] border border-sky-200/80 dark:border-sky-900/70">
            <p className="text-xs font-extrabold text-sky-700 dark:text-sky-400 mb-1">
              Moral & Reflection
            </p>
            <p className="text-sm font-semibold text-blue-950 dark:text-white leading-relaxed">
              {activeStory.moral}
            </p>
          </div>

          {/* Interactive AI Story Companion */}
          <div className="pt-4 border-t border-sky-100 dark:border-sky-950/80 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-extrabold text-blue-950 dark:text-white">
                  Interactive AI Story Companion
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Translate, test your comprehension, learn vocabulary, or ask anything about this story.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={aiLoading}
                onClick={() => runStoryAI('translate')}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                  aiMode === 'translate'
                    ? 'bg-blue-950 dark:bg-sky-600 text-white border-transparent'
                    : 'bg-slate-50 dark:bg-[#081220] text-blue-950 dark:text-sky-300 border-sky-200 dark:border-sky-900/60 hover:bg-sky-50 dark:hover:bg-sky-950/50'
                }`}
              >
                <Languages className="w-3.5 h-3.5" />
                <span>
                  {activeStory.language.toLowerCase().includes('telugu')
                    ? 'Translate to English'
                    : 'Translate to Telugu (తెలుగు)'}
                </span>
              </button>

              <button
                type="button"
                disabled={aiLoading}
                onClick={() => runStoryAI('quiz')}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                  aiMode === 'quiz'
                    ? 'bg-blue-950 dark:bg-sky-600 text-white border-transparent'
                    : 'bg-slate-50 dark:bg-[#081220] text-blue-950 dark:text-sky-300 border-sky-200 dark:border-sky-900/60 hover:bg-sky-50 dark:hover:bg-sky-950/50'
                }`}
              >
                <HelpCircle className="w-3.5 h-3.5" />
                <span>Take 3-Question Story Quiz</span>
              </button>

              <button
                type="button"
                disabled={aiLoading}
                onClick={() => runStoryAI('vocabulary')}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                  aiMode === 'vocabulary'
                    ? 'bg-blue-950 dark:bg-sky-600 text-white border-transparent'
                    : 'bg-slate-50 dark:bg-[#081220] text-blue-950 dark:text-sky-300 border-sky-200 dark:border-sky-900/60 hover:bg-sky-50 dark:hover:bg-sky-950/50'
                }`}
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>Vocabulary & Deep Meaning</span>
              </button>
            </div>

            {/* Inline Ask about Story */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (storyQuestion.trim() && !aiLoading) {
                  runStoryAI('ask');
                }
              }}
              className="flex items-center gap-2"
            >
              <input
                type="text"
                value={storyQuestion}
                onChange={(e) => setStoryQuestion(e.target.value)}
                placeholder="Ask StudyMind AI anything about the characters, theme, or alternate ending..."
                className="flex-1 px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#081220] border border-slate-200 dark:border-sky-950 text-xs sm:text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-sky-400/30 font-medium"
              />
              <button
                type="submit"
                disabled={!storyQuestion.trim() || aiLoading}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-blue-950 dark:bg-sky-600 hover:bg-sky-600 dark:hover:bg-sky-500 disabled:opacity-45 text-white text-xs font-bold transition-colors cursor-pointer shrink-0"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Ask AI</span>
              </button>
            </form>

            {aiLoading && (
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-[#081220] border border-sky-100 dark:border-sky-950 flex items-center gap-2.5 text-xs font-semibold text-sky-700 dark:text-sky-400">
                <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                <span>StudyMind AI is analyzing "{activeStory.title}"...</span>
              </div>
            )}

            {aiError && (
              <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-xs font-semibold text-rose-700 dark:text-rose-300 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{aiError}</span>
              </div>
            )}

            {aiOutput && !aiLoading && (
              <div className="p-5 rounded-2xl bg-slate-50 dark:bg-[#081220] border border-sky-100 dark:border-sky-950">
                <MarkdownRenderer content={aiOutput} className="text-sm" />
              </div>
            )}

            {aiMode === 'quiz' && storyQuiz.length > 0 && !aiLoading && (
              <div className="space-y-4">
                {storyQuiz.map((q, qIdx) => {
                  const chosen = quizAnswers[qIdx];
                  const answered = chosen !== undefined;
                  return (
                    <div
                      key={qIdx}
                      className="p-4 sm:p-5 rounded-2xl bg-slate-50 dark:bg-[#081220] border border-sky-100 dark:border-sky-950 space-y-3"
                    >
                      <p className="text-sm font-bold text-slate-900 dark:text-white">
                        {qIdx + 1}. {q.question}
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {q.options.map((opt, oIdx) => {
                          const isCorrect = oIdx === q.correctIndex;
                          const isChosen = chosen === oIdx;
                          let style =
                            'bg-white dark:bg-[#0c1829] border-slate-200 dark:border-sky-950 text-slate-700 dark:text-slate-200 hover:border-sky-400';
                          if (answered) {
                            if (isCorrect) {
                              style =
                                'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-400 text-emerald-900 dark:text-emerald-200 font-bold';
                            } else if (isChosen) {
                              style =
                                'bg-rose-50 dark:bg-rose-950/50 border-rose-400 text-rose-900 dark:text-rose-200 font-bold';
                            }
                          }
                          return (
                            <button
                              key={oIdx}
                              type="button"
                              disabled={answered}
                              onClick={() => setQuizAnswers((prev) => ({ ...prev, [qIdx]: oIdx }))}
                              className={`p-3 rounded-xl border text-left text-xs transition-colors flex items-center justify-between gap-2 cursor-pointer disabled:cursor-default ${style}`}
                            >
                              <span>
                                {String.fromCharCode(65 + oIdx)}. {opt}
                              </span>
                              {answered && isCorrect && (
                                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                              )}
                              {answered && isChosen && !isCorrect && (
                                <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
                              )}
                            </button>
                          );
                        })}
                      </div>
                      {answered && (
                        <p className="text-xs text-slate-600 dark:text-slate-300 bg-white dark:bg-[#0c1829] p-3 rounded-xl border border-sky-100 dark:border-sky-950">
                          <strong className="text-blue-950 dark:text-sky-300">Explanation: </strong>
                          {q.explanation}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </article>
      </div>
    );
  }

  // Catalog View
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Header Banner */}
      <div className="bg-white dark:bg-[#0c1829] rounded-3xl p-5 sm:p-6 border border-sky-100 dark:border-sky-950/80 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-950 dark:bg-sky-600 text-white flex items-center justify-center shrink-0">
              <Volume2 className="w-5 h-5 text-sky-400 dark:text-white" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-extrabold text-blue-950 dark:text-white tracking-tight">
                Audio Book Library ({allStories.length} Stories)
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Read or listen aloud in English & Telugu — with live AI translation, comprehension quizzes, and custom story creation.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsCreateOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-blue-950 dark:bg-sky-600 hover:bg-sky-600 dark:hover:bg-sky-500 text-white text-xs font-bold shadow-sm transition-colors cursor-pointer self-start md:self-auto whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            <span>Create AI Audio Story</span>
          </button>
        </div>

        {/* Search + Categories */}
        <div className="space-y-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search stories by title, moral, Telugu kathalu, or keyword..."
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-[#081220] rounded-xl border border-slate-200 dark:border-sky-950 text-xs sm:text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-sky-400/30 font-medium"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {categories.map((cat) => {
              const active = selectedCategory === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
                    active
                      ? 'bg-blue-950 dark:bg-sky-600 text-white shadow-xs'
                      : 'bg-sky-50/70 dark:bg-[#081220] text-slate-600 dark:text-slate-300 hover:bg-sky-100 dark:hover:bg-sky-950/60 hover:text-blue-950 dark:hover:text-white'
                  }`}
                >
                  {cat}
                  {cat === 'Bookmarked' ? ` (${bookmarks.length})` : ''}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Stories Grid */}
      {filteredStories.length === 0 ? (
        <div className="bg-white dark:bg-[#0c1829] rounded-2xl p-10 text-center border border-sky-100 dark:border-sky-950/80">
          <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
            No stories match this filter.
          </p>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
            Try switching categories or create a brand-new AI story tailored to your topic.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredStories.map((story) => {
            const saved = bookmarks.includes(story.id);
            return (
              <div
                key={story.id}
                onClick={() => openStory(story)}
                className="group bg-white dark:bg-[#0c1829] hover:border-sky-300 dark:hover:border-sky-700 rounded-2xl p-5 border border-sky-100/90 dark:border-sky-950/80 shadow-2xs transition-all cursor-pointer flex flex-col justify-between gap-4"
              >
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-[11px] font-semibold text-sky-700 dark:text-sky-400">
                      <span>{story.category}</span>
                      <span className="mx-1.5" aria-hidden="true">·</span>
                      <span>{story.language}</span>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => handleToggleBookmark(story.id, e)}
                      aria-label={saved ? 'Remove bookmark' : 'Bookmark story'}
                      className={`p-1 rounded-lg transition-colors cursor-pointer ${
                        saved
                          ? 'text-amber-500'
                          : 'text-slate-300 dark:text-slate-600 hover:text-amber-500'
                      }`}
                    >
                      <Bookmark className={`w-4 h-4 ${saved ? 'fill-current' : ''}`} />
                    </button>
                  </div>

                  <h3 className="text-base font-extrabold text-blue-950 dark:text-white group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors leading-snug">
                    {story.title}
                  </h3>

                  <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
                    {story.shortDescription}
                  </p>
                </div>

                <div className="pt-3 border-t border-slate-100 dark:border-sky-950/80 flex items-center justify-between text-xs">
                  <span className="text-slate-400 dark:text-slate-500 font-medium">
                    {story.readingTime}
                  </span>
                  <span className="inline-flex items-center gap-1 font-bold text-blue-950 dark:text-sky-400 group-hover:translate-x-0.5 transition-transform">
                    <Play className="w-3 h-3 fill-current" />
                    <span>Read & Listen</span>
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Custom Story Creator Modal */}
      {isCreateOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => !creatingStory && setIsCreateOpen(false)}
        >
          <div
            className="bg-white dark:bg-[#0c1829] rounded-2xl max-w-lg w-full p-6 border border-sky-100 dark:border-sky-950/80 shadow-xl space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-950 dark:bg-sky-600 text-white flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-sky-300 dark:text-white" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-blue-950 dark:text-white">
                    Create Custom AI Audio Story
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Describe a theme or moral and StudyMind AI will craft a voiced story.
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={creatingStory}
                onClick={() => setIsCreateOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {createError && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-xs font-semibold text-rose-700 dark:text-rose-300">
                {createError}
              </div>
            )}

            <form onSubmit={handleCreateCustomStory} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Story Idea, Setting, or Moral
                </label>
                <textarea
                  rows={3}
                  value={customTheme}
                  onChange={(e) => setCustomTheme(e.target.value)}
                  placeholder="e.g., A village girl in Warangal who teaches herself astronomy using an old library telescope..."
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-[#081220] rounded-xl border border-slate-200 dark:border-sky-950 text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-sky-400/30 font-medium"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Story Language
                </label>
                <select
                  value={customLanguage}
                  onChange={(e) => setCustomLanguage(e.target.value as LanguageMode)}
                  className="w-full px-3 py-2.5 bg-slate-50 dark:bg-[#081220] rounded-xl border border-slate-200 dark:border-sky-950 text-xs font-semibold text-slate-700 dark:text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-sky-400/30"
                >
                  <option value="Simple English">English</option>
                  <option value="Telugu">Telugu (తెలుగు)</option>
                  <option value="Telugu + English">Bilingual (Telugu + English)</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={!customTheme.trim() || creatingStory}
                className="w-full py-2.5 rounded-xl bg-blue-950 dark:bg-sky-600 hover:bg-sky-600 dark:hover:bg-sky-500 disabled:opacity-50 text-white text-xs font-extrabold transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                {creatingStory ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Writing your original story...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 text-sky-300 dark:text-white" />
                    <span>Generate & Open Audio Story</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
