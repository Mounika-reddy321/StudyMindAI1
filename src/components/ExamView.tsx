import React, { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  Award,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  GraduationCap,
  Loader2,
  MessageSquare,
  RotateCcw,
  Send,
  Sparkles,
  XCircle,
} from 'lucide-react';
import {
  ActiveStudyContext,
  Difficulty,
  ExamAttempt,
  ExamQuestion,
  LanguageMode,
  UserProfile,
} from '../types';
import { explainExamQuestion, generatePracticeExam } from '../services/api';
import { Storage } from '../utils/storage';
import { MarkdownRenderer } from './MarkdownRenderer';

interface ExamViewProps {
  currentUser: UserProfile;
  languageMode: LanguageMode;
  setLanguageMode: (mode: LanguageMode) => void;
  prefill: { topic: string; sourceNotes?: string } | null;
  onConsumePrefill: () => void;
  onContextChange: (ctx: ActiveStudyContext | null) => void;
}

const SUBJECT_PRESETS = [
  'General Studies & Polity',
  'Computer Science & Programming',
  'Science & Biology',
  'Mathematics & Aptitude',
  'Physics & Chemistry',
  'Indian History & Geography',
  'Current Affairs & Economy',
  'English & Reasoning',
];

export const ExamView: React.FC<ExamViewProps> = ({
  currentUser,
  languageMode,
  setLanguageMode,
  prefill,
  onConsumePrefill,
  onContextChange,
}) => {
  const [subject, setSubject] = useState(SUBJECT_PRESETS[0]);
  const [topic, setTopic] = useState('');
  const [sourceNotes, setSourceNotes] = useState<string | undefined>(undefined);
  const [difficulty, setDifficulty] = useState<Difficulty>('Medium');
  const [questionCount, setQuestionCount] = useState<number>(5);

  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [inExam, setInExam] = useState(false);
  const [questions, setQuestions] = useState<ExamQuestion[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [submitted, setSubmitted] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);

  // Interactive per-question AI Deep-Dive Coach state
  const [coachResponses, setCoachResponses] = useState<Record<number, string>>({});
  const [coachLoadingIdx, setCoachLoadingIdx] = useState<number | null>(null);
  const [coachInputs, setCoachInputs] = useState<Record<number, string>>({});

  const [attempts, setAttempts] = useState<ExamAttempt[]>(() =>
    Storage.getExamAttempts(currentUser.id)
  );

  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    setAttempts(Storage.getExamAttempts(currentUser.id));
  }, [currentUser.id]);

  useEffect(() => {
    if (prefill) {
      setTopic(prefill.topic);
      setSourceNotes(prefill.sourceNotes);
      onConsumePrefill();
    }
  }, [prefill, onConsumePrefill]);

  useEffect(() => {
    if (inExam && !submitted) {
      timerRef.current = window.setInterval(() => {
        setElapsedSec((s) => s + 1);
      }, 1000);
    }
    return () => {
      if (timerRef.current !== null) clearInterval(timerRef.current);
    };
  }, [inExam, submitted]);

  useEffect(() => {
    onContextChange({
      source: 'Interactive Exam Simulator',
      title: topic.trim() || subject,
      summary: inExam
        ? `Practicing ${questions.length} ${difficulty} questions on ${topic || subject}.`
        : `Configuring practice exam for ${subject}.`,
    });
  }, [inExam, topic, subject, difficulty, questions.length, onContextChange]);

  const formatTime = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const rem = sec % 60;
    return `${String(mins).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
  };

  const handleStartExam = async () => {
    if (!topic.trim() && !sourceNotes) {
      setError('Please enter a topic to generate your practice exam.');
      return;
    }
    setGenerating(true);
    setError(null);
    setCoachResponses({});
    setCoachInputs({});

    try {
      const res = await generatePracticeExam({
        subject,
        topic: topic.trim() || 'Study Notes Assessment',
        difficulty,
        questionCount,
        languageMode,
        sourceNotes,
      });
      setQuestions(res.questions);
      setAnswers({});
      setCurrentIdx(0);
      setElapsedSec(0);
      setSubmitted(false);
      setInExam(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate practice exam.');
    } finally {
      setGenerating(false);
    }
  };

  const handleSelectOption = (qIdx: number, optIdx: number) => {
    if (submitted) return;
    setAnswers((prev) => ({ ...prev, [qIdx]: optIdx }));
  };

  const handleSubmitExam = () => {
    setSubmitted(true);
    if (timerRef.current !== null) clearInterval(timerRef.current);

    let score = 0;
    const details = questions.map((q, idx) => {
      const chosen = answers[idx];
      const isCorrect = chosen === q.correctIndex;
      if (isCorrect) score++;
      return {
        question: q.question,
        selectedAnswer: chosen === undefined ? 'Unanswered' : q.options[chosen],
        correctAnswer: q.options[q.correctIndex],
        isCorrect,
      };
    });

    const percentage = Math.round((score / Math.max(1, questions.length)) * 100);
    const attempt: ExamAttempt = {
      id: `attempt_${Date.now()}`,
      userId: currentUser.id,
      subject,
      topic: topic.trim() || 'Study Assessment',
      difficulty,
      score,
      total: questions.length,
      percentage,
      completedAt: new Date().toISOString(),
      details,
    };
    Storage.saveExamAttempt(currentUser.id, attempt);
    setAttempts(Storage.getExamAttempts(currentUser.id));
  };

  const handleAskCoach = async (qIdx: number, followUp?: string) => {
    const q = questions[qIdx];
    if (!q) return;
    setCoachLoadingIdx(qIdx);
    try {
      const chosenIdx = answers[qIdx];
      const res = await explainExamQuestion({
        question: q.question,
        options: q.options,
        correctAnswer: q.options[q.correctIndex],
        userAnswer: chosenIdx === undefined ? 'Unanswered' : q.options[chosenIdx],
        languageMode,
        followUp: followUp || coachInputs[qIdx],
      });
      setCoachResponses((prev) => ({ ...prev, [qIdx]: res.explanation }));
      setCoachInputs((prev) => ({ ...prev, [qIdx]: '' }));
    } catch (err) {
      setCoachResponses((prev) => ({
        ...prev,
        [qIdx]: err instanceof Error ? err.message : 'Unable to reach AI Coach.',
      }));
    } finally {
      setCoachLoadingIdx(null);
    }
  };

  const handleRetake = () => {
    setAnswers({});
    setCurrentIdx(0);
    setSubmitted(false);
    setElapsedSec(0);
    setCoachResponses({});
  };

  const handleExitExam = () => {
    setInExam(false);
    setSubmitted(false);
    setQuestions([]);
    setAnswers({});
    setCoachResponses({});
  };

  // Active Exam or Results View
  if (inExam && questions.length > 0) {
    const activeQ = questions[currentIdx];
    const answeredCount = Object.keys(answers).length;
    const score = questions.reduce(
      (acc, q, idx) => acc + (answers[idx] === q.correctIndex ? 1 : 0),
      0
    );
    const percentage = Math.round((score / questions.length) * 100);

    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        <div className="bg-white dark:bg-[#0c1829] rounded-3xl p-6 sm:p-8 border border-sky-100 dark:border-sky-950/80 shadow-sm space-y-6">
          {/* Exam Header */}
          <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-sky-100 dark:border-sky-950/80">
            <div>
              <div className="flex items-center gap-2 text-xs font-bold text-sky-700 dark:text-sky-400">
                <span>{subject}</span>
                <span aria-hidden="true">·</span>
                <span>{difficulty} Difficulty</span>
              </div>
              <h2 className="text-lg font-extrabold text-blue-950 dark:text-white tracking-tight mt-0.5">
                {topic || 'Practice Assessment'}
              </h2>
            </div>

            <div className="flex items-center gap-3">
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sky-50 dark:bg-[#081220] text-sky-800 dark:text-sky-300 font-mono text-xs font-bold border border-sky-100 dark:border-sky-950 tabular-nums">
                <Clock className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                <span>{formatTime(elapsedSec)}</span>
              </div>
              {!submitted && (
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400 tabular-nums">
                  Question {currentIdx + 1} of {questions.length}
                </span>
              )}
            </div>
          </div>

          {submitted ? (
            /* Results & Interactive Coaching View */
            <div className="space-y-6">
              <div className="p-6 rounded-3xl bg-gradient-to-r from-blue-950 via-slate-900 to-sky-700 dark:from-slate-900 dark:via-sky-950 dark:to-blue-900 text-white flex flex-col sm:flex-row items-center justify-between gap-4 shadow-md">
                <div className="flex items-center gap-4 text-center sm:text-left">
                  <div className="w-14 h-14 rounded-2xl bg-white/10 text-sky-300 flex items-center justify-center shrink-0">
                    <Award className="w-7 h-7" />
                  </div>
                  <div>
                    <h3 className="text-xl font-extrabold">Exam Completed</h3>
                    <p className="text-xs text-sky-100 mt-0.5 tabular-nums">
                      Finished in {formatTime(elapsedSec)} with {score} of {questions.length}{' '}
                      correct answers.
                    </p>
                  </div>
                </div>
                <div className="text-center sm:text-right">
                  <div className="text-3xl font-extrabold tabular-nums">{percentage}%</div>
                  <p className="text-xs font-bold text-sky-200 mt-0.5">
                    {percentage >= 80
                      ? 'Mastered'
                      : percentage >= 60
                      ? 'Good Effort'
                      : 'Needs Practice'}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={handleRetake}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-sky-50 dark:bg-[#081220] hover:bg-sky-100 dark:hover:bg-sky-950 text-blue-950 dark:text-sky-300 border border-sky-200 dark:border-sky-900/70 text-xs font-bold transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Retake Same Exam</span>
                </button>
                <button
                  type="button"
                  onClick={handleExitExam}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-950 dark:bg-sky-600 hover:bg-sky-600 dark:hover:bg-sky-500 text-white text-xs font-bold transition-colors cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Create New Exam</span>
                </button>
              </div>

              <div className="space-y-4">
                <h3 className="text-sm font-extrabold text-blue-950 dark:text-white">
                  Comprehensive Question Analysis & Interactive AI Coach
                </h3>
                {questions.map((q, idx) => {
                  const chosen = answers[idx];
                  const isCorrect = chosen === q.correctIndex;
                  const coachReply = coachResponses[idx];
                  const isCoaching = coachLoadingIdx === idx;

                  return (
                    <div
                      key={idx}
                      className={`p-5 rounded-2xl border space-y-3 ${
                        isCorrect
                          ? 'bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/60'
                          : 'bg-rose-50/40 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/60'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-sm font-bold text-slate-900 dark:text-white">
                          {idx + 1}. {q.question}
                        </p>
                        {isCorrect ? (
                          <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 dark:text-emerald-400 shrink-0">
                            <CheckCircle2 className="w-4 h-4" />
                            Correct
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-bold text-rose-700 dark:text-rose-400 shrink-0">
                            <XCircle className="w-4 h-4" />
                            Incorrect
                          </span>
                        )}
                      </div>

                      <div className="space-y-1.5 text-xs">
                        {q.options.map((opt, oIdx) => {
                          const rightOpt = oIdx === q.correctIndex;
                          const pickedOpt = chosen === oIdx;
                          let cls =
                            'bg-white dark:bg-[#0c1829] text-slate-700 dark:text-slate-300 border-slate-200 dark:border-sky-950';
                          if (rightOpt) {
                            cls =
                              'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-200 font-bold border-emerald-300 dark:border-emerald-800';
                          } else if (pickedOpt && !rightOpt) {
                            cls =
                              'bg-rose-100 dark:bg-rose-950/60 text-rose-900 dark:text-rose-200 font-bold border-rose-300 dark:border-rose-800 line-through';
                          }
                          return (
                            <div
                              key={oIdx}
                              className={`p-2.5 rounded-xl border flex items-center justify-between ${cls}`}
                            >
                              <span>
                                {String.fromCharCode(65 + oIdx)}. {opt}
                              </span>
                              {rightOpt && (
                                <span className="text-[11px] font-bold text-emerald-800 dark:text-emerald-300">
                                  Correct Answer
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      <div className="p-3 bg-white dark:bg-[#0c1829] rounded-xl border border-sky-100 dark:border-sky-950/80 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                        <strong className="text-blue-950 dark:text-sky-300">Explanation: </strong>
                        {q.explanation}
                      </div>

                      {/* Interactive AI Coach trigger */}
                      <div className="pt-1 space-y-2.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            disabled={isCoaching}
                            onClick={() => handleAskCoach(idx)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-[#0c1829] hover:bg-sky-50 dark:hover:bg-sky-950 text-blue-950 dark:text-sky-300 border border-sky-200 dark:border-sky-900/70 text-xs font-bold transition-colors cursor-pointer"
                          >
                            {isCoaching ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <MessageSquare className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                            )}
                            <span>Explain Deeper with Memory Tip</span>
                          </button>

                          <form
                            onSubmit={(e) => {
                              e.preventDefault();
                              if (coachInputs[idx]?.trim() && !isCoaching) {
                                handleAskCoach(idx, coachInputs[idx]);
                              }
                            }}
                            className="flex-1 min-w-[220px] flex items-center gap-1.5"
                          >
                            <input
                              type="text"
                              value={coachInputs[idx] || ''}
                              onChange={(e) =>
                                setCoachInputs((prev) => ({ ...prev, [idx]: e.target.value }))
                              }
                              placeholder="Still confused? Ask a follow-up doubt about this question..."
                              className="flex-1 px-3 py-1.5 rounded-xl bg-white dark:bg-[#0c1829] border border-slate-200 dark:border-sky-950 text-xs text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-sky-400/30"
                            />
                            <button
                              type="submit"
                              disabled={!coachInputs[idx]?.trim() || isCoaching}
                              aria-label="Send doubt to AI Coach"
                              className="p-2 rounded-xl bg-blue-950 dark:bg-sky-600 text-white disabled:opacity-40 cursor-pointer"
                            >
                              <Send className="w-3.5 h-3.5" />
                            </button>
                          </form>
                        </div>

                        {coachReply && (
                          <div className="p-4 rounded-xl bg-white dark:bg-[#081220] border border-sky-200/80 dark:border-sky-900/80">
                            <p className="text-[11px] font-extrabold text-sky-700 dark:text-sky-400 mb-1.5">
                              AI Coach Deep-Dive
                            </p>
                            <MarkdownRenderer content={coachReply} className="text-xs sm:text-sm" />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            /* Active Question View */
            <div className="space-y-6">
              {/* Progress Bar */}
              <div className="space-y-2">
                <div className="h-2 rounded-full bg-sky-100 dark:bg-[#081220] overflow-hidden">
                  <div
                    className="h-full bg-blue-950 dark:bg-sky-500 transition-all duration-200"
                    style={{ width: `${((currentIdx + 1) / questions.length) * 100}%` }}
                  />
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {questions.map((_, idx) => {
                    const isCurrent = idx === currentIdx;
                    const isAnswered = answers[idx] !== undefined;
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setCurrentIdx(idx)}
                        className={`w-8 h-8 rounded-lg text-xs font-bold tabular-nums transition-colors cursor-pointer ${
                          isCurrent
                            ? 'bg-blue-950 dark:bg-sky-600 text-white'
                            : isAnswered
                            ? 'bg-sky-100 dark:bg-sky-950 text-sky-800 dark:text-sky-300 border border-sky-200 dark:border-sky-800'
                            : 'bg-slate-50 dark:bg-[#081220] text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-sky-950'
                        }`}
                      >
                        {idx + 1}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Question Prompt */}
              <div className="space-y-4">
                <h3 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white leading-snug">
                  {currentIdx + 1}. {activeQ.question}
                </h3>

                <div className="space-y-2.5">
                  {activeQ.options.map((opt, oIdx) => {
                    const selected = answers[currentIdx] === oIdx;
                    return (
                      <button
                        key={oIdx}
                        type="button"
                        onClick={() => handleSelectOption(currentIdx, oIdx)}
                        className={`w-full p-4 rounded-2xl border text-left text-sm font-semibold transition-all cursor-pointer flex items-center gap-3 ${
                          selected
                            ? 'bg-blue-950 dark:bg-sky-600 text-white border-blue-950 dark:border-sky-500 shadow-xs'
                            : 'bg-slate-50 dark:bg-[#081220] hover:bg-sky-50 dark:hover:bg-sky-950/50 text-slate-800 dark:text-slate-200 border-slate-200 dark:border-sky-950'
                        }`}
                      >
                        <span
                          className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-extrabold shrink-0 ${
                            selected
                              ? 'bg-white/20 text-white'
                              : 'bg-white dark:bg-[#0c1829] text-blue-950 dark:text-sky-400 border border-sky-100 dark:border-sky-900'
                          }`}
                        >
                          {String.fromCharCode(65 + oIdx)}
                        </span>
                        <span>{opt}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Navigation Footer */}
              <div className="pt-4 border-t border-sky-100 dark:border-sky-950/80 flex flex-wrap items-center justify-between gap-3">
                <button
                  type="button"
                  disabled={currentIdx === 0}
                  onClick={() => setCurrentIdx((i) => Math.max(0, i - 1))}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-100 dark:bg-[#081220] hover:bg-sky-100 dark:hover:bg-sky-950 disabled:opacity-40 text-slate-700 dark:text-slate-200 text-xs font-bold transition-colors cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Previous</span>
                </button>

                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 tabular-nums">
                  {answeredCount} of {questions.length} answered
                </span>

                {currentIdx < questions.length - 1 ? (
                  <button
                    type="button"
                    onClick={() => setCurrentIdx((i) => Math.min(questions.length - 1, i + 1))}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-950 dark:bg-sky-600 hover:bg-sky-600 dark:hover:bg-sky-500 text-white text-xs font-bold transition-colors cursor-pointer"
                  >
                    <span>Next Question</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleSubmitExam}
                    className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold transition-colors cursor-pointer"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Submit & Grade Exam</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Setup View
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      <div className="bg-white dark:bg-[#0c1829] rounded-3xl p-6 sm:p-8 border border-sky-100 dark:border-sky-950/80 shadow-sm space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-950 dark:bg-sky-600 text-white flex items-center justify-center shrink-0">
            <GraduationCap className="w-5 h-5 text-sky-400 dark:text-white" />
          </div>
          <div>
            <h2 className="text-xl font-extrabold text-blue-950 dark:text-white tracking-tight">
              Interactive Exam Simulator
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Generate custom timed MCQ tests with instant scoring, detailed explanations, and live AI coaching on any question.
            </p>
          </div>
        </div>

        {sourceNotes && (
          <div className="p-3.5 rounded-xl bg-sky-50 dark:bg-[#081220] border border-sky-200 dark:border-sky-900 flex items-center justify-between gap-3 text-xs">
            <span className="font-semibold text-blue-950 dark:text-sky-300">
              Linked study material attached — questions will be generated directly from your notes.
            </span>
            <button
              type="button"
              onClick={() => setSourceNotes(undefined)}
              className="text-slate-500 hover:text-rose-600 font-bold cursor-pointer shrink-0"
            >
              Clear
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Subject</label>
            <select
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full px-3 py-2.5 bg-slate-50 dark:bg-[#081220] rounded-xl border border-slate-200 dark:border-sky-950 text-xs font-semibold text-slate-700 dark:text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-sky-400/30"
            >
              {SUBJECT_PRESETS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
              Exam Language
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

          <div className="space-y-1.5 md:col-span-2">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
              Specific Exam Topic
            </label>
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g., Indian Constitution Articles 12-35, React Hooks, Photosynthesis, Quadratic Equations..."
              className="w-full px-4 py-2.5 bg-slate-50 dark:bg-[#081220] rounded-xl border border-slate-200 dark:border-sky-950 text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-hidden focus:ring-2 focus:ring-sky-400/30 font-medium"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
              Difficulty Level
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(['Easy', 'Medium', 'Hard'] as const).map((lvl) => (
                <button
                  key={lvl}
                  type="button"
                  onClick={() => setDifficulty(lvl)}
                  className={`py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                    difficulty === lvl
                      ? 'bg-blue-950 dark:bg-sky-600 text-white'
                      : 'bg-slate-50 dark:bg-[#081220] text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-sky-950 hover:border-sky-400'
                  }`}
                >
                  {lvl}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
              Number of Questions
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[5, 10, 15].map((cnt) => (
                <button
                  key={cnt}
                  type="button"
                  onClick={() => setQuestionCount(cnt)}
                  className={`py-2 rounded-xl text-xs font-bold tabular-nums transition-colors cursor-pointer ${
                    questionCount === cnt
                      ? 'bg-blue-950 dark:bg-sky-600 text-white'
                      : 'bg-slate-50 dark:bg-[#081220] text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-sky-950 hover:border-sky-400'
                  }`}
                >
                  {cnt} Qs
                </button>
              ))}
            </div>
          </div>
        </div>

        {error && (
          <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-xs font-semibold text-rose-700 dark:text-rose-300 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <button
          type="button"
          onClick={handleStartExam}
          disabled={generating}
          className="w-full py-3 rounded-xl bg-blue-950 dark:bg-sky-600 hover:bg-sky-600 dark:hover:bg-sky-500 disabled:opacity-50 text-white text-sm font-extrabold shadow-sm transition-colors flex items-center justify-center gap-2 cursor-pointer"
        >
          {generating ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Building Your {questionCount}-Question Exam...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4 text-sky-300 dark:text-white" />
              <span>Start Exam Simulator</span>
            </>
          )}
        </button>
      </div>

      {/* Past Attempts */}
      {attempts.length > 0 && (
        <div className="bg-white dark:bg-[#0c1829] rounded-3xl p-6 border border-sky-100 dark:border-sky-950/80 shadow-xs space-y-4">
          <h3 className="text-sm font-extrabold text-blue-950 dark:text-white">
            Recent Exam Performance ({attempts.length})
          </h3>
          <div className="space-y-2.5">
            {attempts.slice(0, 8).map((att) => (
              <div
                key={att.id}
                className="p-4 rounded-2xl bg-slate-50 dark:bg-[#081220] border border-slate-200/70 dark:border-sky-950 flex flex-wrap items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-bold text-slate-900 dark:text-white truncate">
                    {att.topic}
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
                    {att.subject} · {att.difficulty} ·{' '}
                    {new Date(att.completedAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="text-right tabular-nums">
                  <p className="text-sm font-extrabold text-blue-950 dark:text-sky-400">
                    {att.score}/{att.total} ({att.percentage}%)
                  </p>
                  <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                    {att.percentage >= 80
                      ? 'Mastered'
                      : att.percentage >= 50
                      ? 'Passed'
                      : 'Needs Review'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
