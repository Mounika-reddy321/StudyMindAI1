import React, { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  FileText,
  GraduationCap,
  Layers,
  Loader2,
  MessageSquare,
  RotateCw,
  Sparkles,
  Trash2,
  Upload,
} from 'lucide-react';
import {
  ActiveStudyContext,
  Flashcard,
  LanguageMode,
  NoteType,
  SavedNote,
  UserProfile,
} from '../types';
import { extractPdfText, generateStudyNotes } from '../services/api';
import { Storage } from '../utils/storage';
import { MarkdownRenderer } from './MarkdownRenderer';

interface NotesViewProps {
  currentUser: UserProfile;
  languageMode: LanguageMode;
  setLanguageMode: (mode: LanguageMode) => void;
  prefill: { topic: string; content: string } | null;
  onConsumePrefill: () => void;
  onLaunchExamFromNotes: (topic: string, notesContent: string) => void;
  onDiscussInAssistant: (prompt: string) => void;
  onContextChange: (ctx: ActiveStudyContext | null) => void;
}

export const NotesView: React.FC<NotesViewProps> = ({
  currentUser,
  languageMode,
  setLanguageMode,
  prefill,
  onConsumePrefill,
  onLaunchExamFromNotes,
  onDiscussInAssistant,
  onContextChange,
}) => {
  const [topic, setTopic] = useState('');
  const [content, setContent] = useState('');
  const [noteType, setNoteType] = useState<NoteType>('detailed');
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [extractingPdf, setExtractingPdf] = useState(false);
  const [pdfSuccess, setPdfSuccess] = useState<string | null>(null);
  const [pdfError, setPdfError] = useState<string | null>(null);

  const [generating, setGenerating] = useState(false);
  const [generatedNotes, setGeneratedNotes] = useState<string | null>(null);
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [activeCardIdx, setActiveCardIdx] = useState(0);
  const [isCardFlipped, setIsCardFlipped] = useState(false);
  const [masteredCards, setMasteredCards] = useState<number[]>([]);
  const [activeOutputTab, setActiveOutputTab] = useState<'notes' | 'flashcards'>('notes');

  const [genError, setGenError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [savedNotes, setSavedNotes] = useState<SavedNote[]>(() =>
    Storage.getSavedNotes(currentUser.id)
  );

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setSavedNotes(Storage.getSavedNotes(currentUser.id));
  }, [currentUser.id]);

  useEffect(() => {
    if (prefill) {
      setTopic(prefill.topic);
      setContent(prefill.content);
      onConsumePrefill();
    }
  }, [prefill, onConsumePrefill]);

  useEffect(() => {
    onContextChange({
      source: 'Smart Notes Generator',
      title: topic.trim() || 'Academic Notes Workspace',
      summary: generatedNotes
        ? generatedNotes.slice(0, 2800)
        : content.slice(0, 1500) || 'Student is preparing academic study notes.',
    });
  }, [topic, generatedNotes, content, onContextChange]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPdfError(null);
    setPdfSuccess(null);

    const allowed =
      file.type === 'application/pdf' ||
      file.type.startsWith('image/') ||
      file.type === 'text/plain';

    if (!allowed) {
      setPdfError('Please upload a PDF document (.pdf), image of handwritten/textbook notes, or .txt file.');
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      setPdfError('File size exceeds the 15MB limit. Please upload a smaller document.');
      return;
    }

    setUploadedFileName(file.name);

    if (file.type === 'text/plain') {
      const txt = await file.text();
      setContent(txt);
      if (!topic) setTopic(file.name.replace(/\.txt$/i, ''));
      setPdfSuccess(`Loaded ${txt.length.toLocaleString()} characters from ${file.name}.`);
      return;
    }

    setExtractingPdf(true);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const result = await extractPdfText(dataUrl, file.name);
      setContent(result.text);
      if (!topic) setTopic(file.name.replace(/\.(pdf|png|jpe?g|webp)$/i, ''));
      setPdfSuccess(
        `Extracted ${result.textLength.toLocaleString()} characters from ${result.pages} ${
          result.pages === 1 ? 'page' : 'pages'
        }.`
      );
    } catch (err) {
      setPdfError(
        err instanceof Error ? err.message : 'Could not extract text from this document.'
      );
      setUploadedFileName(null);
    } finally {
      setExtractingPdf(false);
    }
  };

  const handleGenerate = async () => {
    if (!topic.trim() && !content.trim()) {
      setGenError('Please provide a study topic or paste/upload source material.');
      return;
    }
    setGenerating(true);
    setGenError(null);
    setGeneratedNotes(null);
    setFlashcards([]);
    setActiveCardIdx(0);
    setIsCardFlipped(false);
    setMasteredCards([]);

    try {
      const result = await generateStudyNotes({
        topic: topic.trim(),
        content: content.trim(),
        languageMode,
        noteType,
      });
      setGeneratedNotes(result.notes);
      setFlashcards(result.flashcards || []);
      setActiveOutputTab('notes');

      const record: SavedNote = {
        id: `note_${Date.now()}`,
        userId: currentUser.id,
        title: topic.trim() || 'Comprehensive Study Notes',
        topic: topic.trim() || 'Study Notes',
        noteType,
        languageMode,
        content: result.notes,
        flashcards: result.flashcards,
        createdAt: new Date().toISOString(),
      };
      Storage.saveNote(currentUser.id, record);
      setSavedNotes(Storage.getSavedNotes(currentUser.id));
    } catch (err) {
      setGenError(err instanceof Error ? err.message : 'Failed to generate notes.');
    } finally {
      setGenerating(false);
    }
  };

  const handleCopy = () => {
    if (!generatedNotes) return;
    navigator.clipboard.writeText(generatedNotes);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const handleDownload = () => {
    if (!generatedNotes) return;
    const blob = new Blob([generatedNotes], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(topic || 'StudyMind_Notes').replace(/[^a-zA-Z0-9_-]/g, '_')}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleOpenSaved = (note: SavedNote) => {
    setTopic(note.title);
    setGeneratedNotes(note.content);
    setFlashcards(note.flashcards || []);
    setActiveCardIdx(0);
    setIsCardFlipped(false);
    setMasteredCards([]);
    setActiveOutputTab('notes');
    window.scrollTo({ top: 380, behavior: 'smooth' });
  };

  const handleDeleteSaved = (noteId: string) => {
    Storage.deleteNote(currentUser.id, noteId);
    setSavedNotes(Storage.getSavedNotes(currentUser.id));
  };

  const currentCard = flashcards[activeCardIdx];

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Generator Form */}
      <div className="bg-white dark:bg-[#0c1829] rounded-3xl p-6 sm:p-8 border border-sky-100 dark:border-sky-950/80 shadow-sm space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-950 dark:bg-sky-600 text-white flex items-center justify-center shrink-0">
            <FileText className="w-5 h-5 text-sky-400 dark:text-white" />
          </div>
          <div>
            <h2 className="text-xl font-extrabold text-blue-950 dark:text-white tracking-tight">
              Smart Notes & Flashcards Generator
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Synthesize structured academic notes and active-recall flashcards from any topic, textbook excerpt, or uploaded PDF/photo.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5 md:col-span-2">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
              Study Topic or Subject Name
            </label>
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g., Indian Constitution Fundamental Rights, Binary Search Trees, Organic Chemistry Reactions..."
              className="w-full px-4 py-2.5 bg-slate-50 dark:bg-[#081220] rounded-xl border border-slate-200 dark:border-sky-950 text-sm focus:outline-hidden focus:ring-2 focus:ring-sky-400/30 text-slate-800 dark:text-slate-100 font-medium placeholder-slate-400 dark:placeholder-slate-500"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
              Explanation Language
            </label>
            <select
              value={languageMode}
              onChange={(e) => setLanguageMode(e.target.value as LanguageMode)}
              className="w-full px-3 py-2.5 bg-slate-50 dark:bg-[#081220] rounded-xl border border-slate-200 dark:border-sky-950 text-xs font-semibold text-slate-700 dark:text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-sky-400/30"
            >
              <option value="Simple English">Simple English</option>
              <option value="Telugu">Telugu (తెలుగు)</option>
              <option value="Telugu + English">Telugu + English (Bilingual)</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
              Notes Depth & Format
            </label>
            <select
              value={noteType}
              onChange={(e) => setNoteType(e.target.value as NoteType)}
              className="w-full px-3 py-2.5 bg-slate-50 dark:bg-[#081220] rounded-xl border border-slate-200 dark:border-sky-950 text-xs font-semibold text-slate-700 dark:text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-sky-400/30"
            >
              <option value="detailed">Comprehensive Study Notes (Detailed)</option>
              <option value="concise">Concise High-Yield Summary (Quick Revision)</option>
              <option value="exam-oriented">Exam-Oriented (Formulas & Practice Questions)</option>
            </select>
          </div>
        </div>

        {/* Upload PDF / Notes Photo */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
              Upload Study PDF, Photo of Notes, or Paste Syllabus (Optional)
            </label>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={extractingPdf}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sky-50 dark:bg-[#081220] hover:bg-sky-100 dark:hover:bg-sky-950/60 text-blue-950 dark:text-sky-300 border border-sky-200 dark:border-sky-900/60 text-xs font-bold transition-colors cursor-pointer"
            >
              {extractingPdf ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Extracting with AI...</span>
                </>
              ) : (
                <>
                  <Upload className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                  <span>{uploadedFileName ? `Uploaded: ${uploadedFileName}` : 'Upload PDF / Image'}</span>
                </>
              )}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.txt,image/*"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>

          {pdfSuccess && (
            <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
              {pdfSuccess}
            </p>
          )}
          {pdfError && (
            <p className="text-xs font-semibold text-rose-600 dark:text-rose-400">{pdfError}</p>
          )}

          <textarea
            rows={4}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Paste lecture transcript, textbook chapter, or syllabus points here (or leave blank to generate notes directly from the topic above)..."
            className="w-full px-4 py-3 bg-slate-50 dark:bg-[#081220] rounded-xl border border-slate-200 dark:border-sky-950 text-xs sm:text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-hidden focus:ring-2 focus:ring-sky-400/30 font-medium"
          />
        </div>

        {genError && (
          <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-xs font-semibold text-rose-700 dark:text-rose-300 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{genError}</span>
          </div>
        )}

        <button
          type="button"
          onClick={handleGenerate}
          disabled={generating || extractingPdf}
          className="w-full py-3 rounded-xl bg-blue-950 dark:bg-sky-600 hover:bg-sky-600 dark:hover:bg-sky-500 disabled:opacity-50 text-white text-sm font-extrabold shadow-sm transition-colors flex items-center justify-center gap-2 cursor-pointer"
        >
          {generating ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Synthesizing Study Notes & Interactive Flashcards...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4 text-sky-300 dark:text-white" />
              <span>Generate Academic Notes & Flashcards</span>
            </>
          )}
        </button>
      </div>

      {/* Generated Notes + Interactive Flashcards Output */}
      {generatedNotes && (
        <div className="bg-white dark:bg-[#0c1829] rounded-3xl p-6 sm:p-8 border border-sky-100 dark:border-sky-950/80 shadow-sm space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-sky-100 dark:border-sky-950/80">
            <div className="inline-flex items-center bg-slate-100 dark:bg-[#081220] p-1 rounded-xl text-xs font-bold">
              <button
                type="button"
                onClick={() => setActiveOutputTab('notes')}
                className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg transition-colors cursor-pointer ${
                  activeOutputTab === 'notes'
                    ? 'bg-blue-950 dark:bg-sky-600 text-white'
                    : 'text-slate-600 dark:text-slate-400 hover:text-blue-950 dark:hover:text-white'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Structured Notes</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveOutputTab('flashcards')}
                className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg transition-colors cursor-pointer ${
                  activeOutputTab === 'flashcards'
                    ? 'bg-blue-950 dark:bg-sky-600 text-white'
                    : 'text-slate-600 dark:text-slate-400 hover:text-blue-950 dark:hover:text-white'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Flashcards ({flashcards.length})</span>
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleCopy}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-[#081220] hover:bg-sky-50 dark:hover:bg-sky-950/60 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-sky-950 text-xs font-bold transition-colors cursor-pointer"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>

              <button
                type="button"
                onClick={handleDownload}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-[#081220] hover:bg-sky-50 dark:hover:bg-sky-950/60 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-sky-950 text-xs font-bold transition-colors cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download .md</span>
              </button>

              <button
                type="button"
                onClick={() => onLaunchExamFromNotes(topic || 'Study Notes Exam', generatedNotes)}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-blue-950 dark:bg-sky-600 hover:bg-sky-600 dark:hover:bg-sky-500 text-white text-xs font-bold transition-colors cursor-pointer"
              >
                <GraduationCap className="w-3.5 h-3.5" />
                <span>Test Me on These Notes</span>
              </button>

              <button
                type="button"
                onClick={() =>
                  onDiscussInAssistant(
                    `Help me review and explain the trickiest parts of my study notes on "${topic || 'this topic'}":\n\n${generatedNotes.slice(0, 1800)}`
                  )
                }
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sky-50 dark:bg-[#081220] hover:bg-sky-100 dark:hover:bg-sky-950 text-blue-950 dark:text-sky-300 border border-sky-200 dark:border-sky-900/70 text-xs font-bold transition-colors cursor-pointer"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>Ask Tutor</span>
              </button>
            </div>
          </div>

          {activeOutputTab === 'notes' ? (
            <MarkdownRenderer content={generatedNotes} className="text-sm sm:text-[15px]" />
          ) : flashcards.length > 0 && currentCard ? (
            <div className="space-y-5 max-w-2xl mx-auto py-2">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400 tabular-nums">
                <span>
                  Card {activeCardIdx + 1} of {flashcards.length}
                </span>
                <span>
                  Mastered: {masteredCards.length} / {flashcards.length}
                </span>
              </div>

              <button
                type="button"
                onClick={() => setIsCardFlipped((f) => !f)}
                className="w-full min-h-[220px] p-6 sm:p-8 rounded-2xl bg-gradient-to-br from-sky-50 via-white to-blue-50/50 dark:from-[#081220] dark:via-[#0a1526] dark:to-[#0c1829] border border-sky-200 dark:border-sky-900/80 text-center flex flex-col items-center justify-center gap-4 shadow-xs transition-all cursor-pointer"
              >
                <span className="text-xs font-bold text-sky-700 dark:text-sky-400">
                  {isCardFlipped ? 'Answer' : 'Question / Concept'}
                </span>
                <p className="text-base sm:text-lg font-extrabold text-blue-950 dark:text-white leading-relaxed">
                  {isCardFlipped ? currentCard.back : currentCard.front}
                </p>
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 dark:text-slate-500">
                  <RotateCw className="w-3.5 h-3.5" />
                  <span>Click card to flip</span>
                </span>
              </button>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsCardFlipped(false);
                    setActiveCardIdx((i) => (i > 0 ? i - 1 : flashcards.length - 1));
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-100 dark:bg-[#081220] hover:bg-sky-100 dark:hover:bg-sky-950 text-slate-700 dark:text-slate-200 text-xs font-bold transition-colors cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Previous</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setMasteredCards((prev) =>
                      prev.includes(activeCardIdx)
                        ? prev.filter((x) => x !== activeCardIdx)
                        : [...prev, activeCardIdx]
                    );
                  }}
                  className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                    masteredCards.includes(activeCardIdx)
                      ? 'bg-emerald-600 text-white'
                      : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                  }`}
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>
                    {masteredCards.includes(activeCardIdx) ? 'Mastered' : 'Mark as Mastered'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsCardFlipped(false);
                    setActiveCardIdx((i) => (i + 1) % flashcards.length);
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-950 dark:bg-sky-600 hover:bg-sky-600 dark:hover:bg-sky-500 text-white text-xs font-bold transition-colors cursor-pointer"
                >
                  <span>Next Card</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Generate fresh notes to create interactive flashcards for this topic.
            </p>
          )}
        </div>
      )}

      {/* Saved Notes Archive */}
      {savedNotes.length > 0 && (
        <div className="bg-white dark:bg-[#0c1829] rounded-3xl p-6 border border-sky-100 dark:border-sky-950/80 shadow-xs space-y-4">
          <h3 className="text-sm font-extrabold text-blue-950 dark:text-white">
            Saved Notes Library ({savedNotes.length})
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {savedNotes.map((note) => (
              <div
                key={note.id}
                onClick={() => handleOpenSaved(note)}
                className="p-4 rounded-2xl bg-slate-50 dark:bg-[#081220] hover:bg-sky-50/70 dark:hover:bg-sky-950/40 border border-slate-200/70 dark:border-sky-950 transition-colors cursor-pointer flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                    {note.title}
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
                    {note.noteType} · {new Date(note.createdAt).toLocaleDateString()}
                    {note.flashcards?.length ? ` · ${note.flashcards.length} cards` : ''}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteSaved(note.id);
                  }}
                  aria-label="Delete saved note"
                  className="p-2 rounded-xl text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-white dark:hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
