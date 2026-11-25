import React from 'react';
import { Menu, Moon, Sun } from 'lucide-react';
import { TabId, UserProfile } from '../types';

interface TopBarProps {
  activeTab: TabId;
  currentUser: UserProfile;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  onOpenMobile: () => void;
  onOpenAuth: () => void;
}

const TAB_META: Record<TabId, { title: string; subtitle: string }> = {
  assistant: {
    title: 'AI Study Assistant',
    subtitle: 'Ask anything. Learn interactively at your own pace.',
  },
  history: {
    title: 'Saved Conversations',
    subtitle: 'Review and resume your personalized study chat sessions.',
  },
  library: {
    title: 'Story & Audio Book Library',
    subtitle: '100 original stories with voice playback, AI translation, quizzes & custom creator.',
  },
  notes: {
    title: 'Smart Notes Generator',
    subtitle: 'Generate structured academic notes and flashcards from topics or uploaded PDFs.',
  },
  exam: {
    title: 'Interactive Exam Simulator',
    subtitle: 'Test your mastery with AI-generated MCQs, timers, and deep-dive coaching.',
  },
  news: {
    title: 'Daily News & Newspapers',
    subtitle: 'Live verified RSS headlines, AI current affairs briefs, and newspaper portals.',
  },
};

export const TopBar: React.FC<TopBarProps> = ({
  activeTab,
  currentUser,
  theme,
  onToggleTheme,
  onOpenMobile,
  onOpenAuth,
}) => {
  const meta = TAB_META[activeTab] || TAB_META.assistant;

  return (
    <header className="sticky top-0 z-30 bg-[#f0f6fa]/90 dark:bg-[#070e18]/90 backdrop-blur-md border-b border-sky-100/80 dark:border-sky-950/70 px-4 sm:px-8 py-3.5 flex items-center justify-between gap-4 transition-colors">
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={onOpenMobile}
          aria-label="Open Navigation"
          className="lg:hidden p-2 text-slate-600 dark:text-slate-300 hover:text-blue-950 dark:hover:text-white hover:bg-sky-100/70 dark:hover:bg-sky-950/60 rounded-xl transition-colors cursor-pointer shrink-0"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="min-w-0">
          <h1 className="text-lg sm:text-xl font-extrabold text-blue-950 dark:text-white tracking-tight truncate">
            {meta.title}
          </h1>
          <p className="hidden sm:block text-xs text-slate-500 dark:text-slate-400 truncate">
            {meta.subtitle}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
        <button
          type="button"
          onClick={onToggleTheme}
          title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          aria-label={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white dark:bg-[#0c1829] hover:bg-sky-50 dark:hover:bg-sky-950/60 text-slate-700 dark:text-sky-300 border border-sky-100 dark:border-sky-950 text-xs font-bold transition-colors cursor-pointer whitespace-nowrap shrink-0"
        >
          {theme === 'dark' ? (
            <>
              <Sun className="w-4 h-4 text-amber-400" />
              <span className="hidden sm:inline">Light</span>
            </>
          ) : (
            <>
              <Moon className="w-4 h-4 text-sky-600" />
              <span className="hidden sm:inline">Dark</span>
            </>
          )}
        </button>

        <button
          type="button"
          onClick={onOpenAuth}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white dark:bg-[#0c1829] hover:bg-sky-50 dark:hover:bg-sky-950/60 text-slate-700 dark:text-slate-200 hover:text-blue-950 dark:hover:text-white border border-sky-100 dark:border-sky-950 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0"
        >
          <span className="w-5 h-5 rounded-full bg-blue-950 dark:bg-sky-500 text-white flex items-center justify-center font-bold text-[10px]">
            {currentUser.displayName ? currentUser.displayName[0].toUpperCase() : 'U'}
          </span>
          <span className="hidden md:inline max-w-[140px] truncate">{currentUser.displayName}</span>
        </button>
      </div>
    </header>
  );
};
