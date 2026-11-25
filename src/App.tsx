import { useEffect, useState } from 'react';
import { ActiveStudyContext, LanguageMode, TabId, UserProfile } from './types';
import { Storage } from './utils/storage';
import { Sidebar } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { AuthModal } from './components/AuthModal';
import { AssistantView } from './components/AssistantView';
import { HistoryView } from './components/HistoryView';
import { LibraryView } from './components/LibraryView';
import { NotesView } from './components/NotesView';
import { ExamView } from './components/ExamView';
import { NewsView } from './components/NewsView';
import { FloatingTutorDrawer } from './components/FloatingTutorDrawer';

export default function App() {
  const [activeTab, setActiveTab] = useState<TabId>('assistant');
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('studymind_theme');
    if (saved === 'dark' || saved === 'light') return saved;
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });
  const [currentUser, setCurrentUser] = useState<UserProfile>(() => Storage.getCurrentUser());
  const [languageMode, setLanguageMode] = useState<LanguageMode>('Simple English');
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [isOpenMobile, setIsOpenMobile] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [totalStoriesCount, setTotalStoriesCount] = useState<number>(100);

  // Seamless cross-tab handoffs & context awareness
  const [pendingAssistantPrompt, setPendingAssistantPrompt] = useState<string | null>(null);
  const [notesPrefill, setNotesPrefill] = useState<{ topic: string; content: string } | null>(null);
  const [examPrefill, setExamPrefill] = useState<{ topic: string; sourceNotes?: string } | null>(
    null
  );
  const [activeStudyContext, setActiveStudyContext] = useState<ActiveStudyContext | null>(null);

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('studymind_theme', theme);
  }, [theme]);

  useEffect(() => {
    Storage.setCurrentUser(currentUser);
  }, [currentUser]);

  const handleToggleTheme = () => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  const handleLaunchNotes = (topic: string, content: string) => {
    setNotesPrefill({ topic, content });
    setActiveTab('notes');
  };

  const handleLaunchExam = (topic: string, sourceNotes?: string) => {
    setExamPrefill({ topic, sourceNotes });
    setActiveTab('exam');
  };

  const handleDiscussInAssistant = (prompt: string) => {
    setPendingAssistantPrompt(prompt);
    setActiveTab('assistant');
  };

  return (
    <div className="min-h-screen bg-[#f0f6fa] dark:bg-[#060d17] text-slate-800 dark:text-slate-100 flex flex-col antialiased transition-colors duration-200">
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        currentUser={currentUser}
        theme={theme}
        onToggleTheme={handleToggleTheme}
        onOpenAuth={() => setIsAuthOpen(true)}
        isOpenMobile={isOpenMobile}
        setIsOpenMobile={setIsOpenMobile}
        totalStoriesCount={totalStoriesCount}
      />

      <div className="lg:pl-72 flex-1 flex flex-col min-w-0">
        <TopBar
          activeTab={activeTab}
          currentUser={currentUser}
          theme={theme}
          onToggleTheme={handleToggleTheme}
          onOpenMobile={() => setIsOpenMobile(true)}
          onOpenAuth={() => setIsAuthOpen(true)}
        />

        <main className="flex-1 pb-12">
          {activeTab === 'assistant' && (
            <AssistantView
              currentUser={currentUser}
              currentConversationId={currentConversationId}
              setCurrentConversationId={setCurrentConversationId}
              languageMode={languageMode}
              setLanguageMode={setLanguageMode}
              pendingPrompt={pendingAssistantPrompt}
              onConsumePendingPrompt={() => setPendingAssistantPrompt(null)}
              onNavigateHistory={() => setActiveTab('history')}
              onLaunchNotesWithTopic={handleLaunchNotes}
              onLaunchExamWithTopic={handleLaunchExam}
            />
          )}

          {activeTab === 'history' && (
            <HistoryView
              currentUser={currentUser}
              onSelectConversation={(id) => {
                setCurrentConversationId(id);
                setActiveTab('assistant');
              }}
              onStartNewChat={() => {
                setCurrentConversationId(null);
                setActiveTab('assistant');
              }}
            />
          )}

          {activeTab === 'library' && (
            <LibraryView
              currentUser={currentUser}
              languageMode={languageMode}
              onCustomStoriesChange={setTotalStoriesCount}
              onContextChange={setActiveStudyContext}
            />
          )}

          {activeTab === 'notes' && (
            <NotesView
              currentUser={currentUser}
              languageMode={languageMode}
              setLanguageMode={setLanguageMode}
              prefill={notesPrefill}
              onConsumePrefill={() => setNotesPrefill(null)}
              onLaunchExamFromNotes={handleLaunchExam}
              onDiscussInAssistant={handleDiscussInAssistant}
              onContextChange={setActiveStudyContext}
            />
          )}

          {activeTab === 'exam' && (
            <ExamView
              currentUser={currentUser}
              languageMode={languageMode}
              setLanguageMode={setLanguageMode}
              prefill={examPrefill}
              onConsumePrefill={() => setExamPrefill(null)}
              onContextChange={setActiveStudyContext}
            />
          )}

          {activeTab === 'news' && (
            <NewsView
              languageMode={languageMode}
              onDiscussInAssistant={handleDiscussInAssistant}
              onContextChange={setActiveStudyContext}
            />
          )}
        </main>
      </div>

      {/* Always-interactive Quick Study Companion drawer on non-assistant tabs */}
      {activeTab !== 'assistant' && (
        <FloatingTutorDrawer
          context={activeStudyContext}
          languageMode={languageMode}
          onExpandToAssistant={handleDiscussInAssistant}
        />
      )}

      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        currentUser={currentUser}
        onUpdateUser={setCurrentUser}
      />
    </div>
  );
}
