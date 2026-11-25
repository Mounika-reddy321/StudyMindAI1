import React from 'react';
import {
  BookOpen,
  FileText,
  GraduationCap,
  History,
  LogOut,
  MessageSquare,
  Moon,
  Newspaper,
  Sparkles,
  Sun,
  User,
  X,
} from 'lucide-react';
import { TabId, UserProfile } from '../types';

interface SidebarProps {
  activeTab: TabId;
  setActiveTab: (tab: TabId) => void;
  currentUser: UserProfile;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  onOpenAuth: () => void;
  isOpenMobile: boolean;
  setIsOpenMobile: (open: boolean) => void;
  totalStoriesCount: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  currentUser,
  theme,
  onToggleTheme,
  onOpenAuth,
  isOpenMobile,
  setIsOpenMobile,
  totalStoriesCount,
}) => {
  const navItems: Array<{
    id: TabId;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    meta?: string;
  }> = [
    { id: 'assistant', label: 'AI Assistant', icon: MessageSquare, meta: 'Live' },
    { id: 'history', label: 'Chat History', icon: History },
    { id: 'library', label: 'Audio Book Library', icon: BookOpen, meta: `${totalStoriesCount}` },
    { id: 'notes', label: 'Notes Generator', icon: FileText, meta: 'PDF' },
    { id: 'exam', label: 'Exam Simulator', icon: GraduationCap, meta: 'Quiz' },
    { id: 'news', label: 'Daily News', icon: Newspaper, meta: 'RSS' },
  ];

  const handleSelect = (id: TabId) => {
    setActiveTab(id);
    setIsOpenMobile(false);
  };

  return (
    <>
      {isOpenMobile && (
        <div
          className="fixed inset-0 bg-slate-900/45 backdrop-blur-xs z-40 lg:hidden"
          onClick={() => setIsOpenMobile(false)}
        />
      )}

      <aside
        className={`fixed top-0 bottom-0 left-0 w-72 bg-white dark:bg-[#070f1c] border-r border-sky-100/90 dark:border-sky-950/80 z-50 flex flex-col transition-transform duration-200 ease-out lg:translate-x-0 ${
          isOpenMobile ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand Header */}
        <div className="p-5 border-b border-sky-100/70 dark:border-sky-950/70 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => handleSelect('assistant')}
            className="flex items-center gap-3 text-left cursor-pointer focus-visible:outline-2 focus-visible:outline-sky-500 rounded-xl"
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-950 via-slate-900 to-sky-500 dark:from-blue-900 dark:via-sky-900 dark:to-sky-500 flex items-center justify-center text-white shadow-md shadow-sky-500/20 shrink-0">
              <Sparkles className="w-5 h-5 text-sky-300" />
            </div>
            <div className="min-w-0">
              <div className="flex items-baseline gap-1.5">
                <span className="font-extrabold text-xl tracking-tight text-slate-900 dark:text-white whitespace-nowrap">
                  Study<span className="text-sky-600 dark:text-sky-400">Mind</span>
                </span>
                <span className="text-xs font-extrabold text-sky-700 dark:text-sky-400">AI</span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium truncate">
                Your personal study space
              </p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setIsOpenMobile(false)}
            aria-label="Close sidebar"
            className="lg:hidden p-2 rounded-xl text-slate-500 hover:text-blue-950 dark:text-slate-400 dark:hover:text-white hover:bg-sky-50 dark:hover:bg-sky-950/50 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation Links */}
        <div className="flex-1 overflow-y-auto px-4 py-5 space-y-6">
          <div>
            <div className="px-3 mb-2.5">
              <span className="text-xs font-bold text-slate-400 dark:text-slate-500">
                Workspace
              </span>
            </div>
            <nav className="space-y-1.5" aria-label="Primary Workspace Navigation">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleSelect(item.id)}
                    className={`w-full flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-150 cursor-pointer whitespace-nowrap focus-visible:outline-2 focus-visible:outline-sky-500 ${
                      isActive
                        ? 'bg-blue-950 dark:bg-sky-600 text-white shadow-md shadow-blue-950/20 dark:shadow-sky-600/25'
                        : 'text-slate-600 dark:text-slate-300 hover:text-blue-950 dark:hover:text-white hover:bg-sky-50/80 dark:hover:bg-sky-950/40'
                    }`}
                  >
                    <span className="flex items-center gap-3 min-w-0">
                      <Icon
                        className={`w-4 h-4 shrink-0 ${
                          isActive
                            ? 'text-sky-400 dark:text-white'
                            : 'text-slate-400 dark:text-slate-500'
                        }`}
                      />
                      <span className="truncate">{item.label}</span>
                    </span>
                    {item.meta && (
                      <span
                        className={`text-[11px] font-semibold tabular-nums shrink-0 ${
                          isActive
                            ? 'text-sky-300 dark:text-sky-100'
                            : 'text-slate-400 dark:text-slate-500'
                        }`}
                      >
                        {item.meta}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          </div>
        </div>

        {/* Bottom Theme + Profile */}
        <div className="p-4 border-t border-sky-100/70 dark:border-sky-950/70 space-y-3">
          <button
            type="button"
            onClick={onToggleTheme}
            className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold bg-slate-50 dark:bg-[#0a1526] border border-slate-200/80 dark:border-sky-950/80 text-slate-700 dark:text-slate-300 hover:bg-sky-50 dark:hover:bg-sky-950/40 transition-colors cursor-pointer"
          >
            <span className="flex items-center gap-2">
              {theme === 'dark' ? (
                <Sun className="w-3.5 h-3.5 text-amber-400" />
              ) : (
                <Moon className="w-3.5 h-3.5 text-sky-600" />
              )}
              <span>{theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}</span>
            </span>
            <span className="text-[11px] font-bold text-sky-700 dark:text-sky-400 capitalize">
              {theme}
            </span>
          </button>

          <div className="p-3.5 rounded-2xl bg-gradient-to-br from-sky-50 via-blue-50/40 to-white dark:from-[#0c1829] dark:via-[#0a1526] dark:to-[#0c1829] border border-sky-100/90 dark:border-sky-950/80">
            <p className="text-xs font-bold text-blue-950 dark:text-sky-300">
              Learning, made lighter
            </p>
            <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed mt-1">
              Ask questions, flip flashcards, practice exams, and discuss stories interactively.
            </p>
          </div>

          <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50 dark:bg-[#0a1526] border border-slate-200/70 dark:border-sky-950/70">
            <button
              type="button"
              onClick={onOpenAuth}
              className="flex items-center gap-2.5 min-w-0 text-left cursor-pointer flex-1"
            >
              <div className="w-8 h-8 rounded-full bg-sky-100 dark:bg-sky-900/60 text-blue-950 dark:text-sky-300 flex items-center justify-center font-bold text-xs shrink-0">
                {currentUser.displayName ? currentUser.displayName[0].toUpperCase() : 'U'}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                  {currentUser.displayName}
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                  {currentUser.email}
                </p>
              </div>
            </button>

            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={onOpenAuth}
                title="Account Settings"
                aria-label="Account Settings"
                className="p-1.5 text-slate-400 hover:text-sky-600 dark:hover:text-sky-400 hover:bg-white dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
              >
                <User className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={onOpenAuth}
                title="Switch Account"
                aria-label="Switch Account"
                className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-white dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};
