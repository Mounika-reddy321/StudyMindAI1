import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  Atom,
  CheckCircle2,
  Cpu,
  ExternalLink,
  Globe,
  GraduationCap,
  Landmark,
  Loader2,
  MapPin,
  MessageSquare,
  Newspaper,
  RefreshCw,
  Search,
  Sparkles,
  XCircle,
} from 'lucide-react';
import { NEWSPAPER_DIRECTORY } from '../data/newsDirectory';
import { ActiveStudyContext, LanguageMode, NewsArticle } from '../types';
import { fetchNewsFeed, generateNewsBrief, NewsBriefResult } from '../services/api';

interface NewsViewProps {
  languageMode: LanguageMode;
  onDiscussInAssistant: (prompt: string) => void;
  onContextChange: (ctx: ActiveStudyContext | null) => void;
}

const CATEGORIES = [
  { id: 'all', label: 'All Headlines', icon: Globe },
  { id: 'india', label: 'India News', icon: Landmark },
  { id: 'ap-ts', label: 'AP & Telangana', icon: MapPin },
  { id: 'world', label: 'World News', icon: Globe },
  { id: 'technology', label: 'Technology & AI', icon: Cpu },
  { id: 'education', label: 'Education & Exams', icon: GraduationCap },
  { id: 'science', label: 'Science & Discovery', icon: Atom },
];

export const NewsView: React.FC<NewsViewProps> = ({
  languageMode,
  onDiscussInAssistant,
  onContextChange,
}) => {
  const [subTab, setSubTab] = useState<'live' | 'directory'>('live');
  const [category, setCategory] = useState('all');
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  // Interactive AI Current Affairs Brief per headline
  const [briefs, setBriefs] = useState<Record<string, NewsBriefResult>>({});
  const [briefLoadingId, setBriefLoadingId] = useState<string | null>(null);
  const [briefErrorMap, setBriefErrorMap] = useState<Record<string, string>>({});
  const [mcqSelected, setMcqSelected] = useState<Record<string, number>>({});

  const loadFeed = async (cat: string, refresh = false) => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchNewsFeed(cat, refresh);
      setArticles(data.articles || []);
      setLastUpdated(data.lastUpdated);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to fetch live RSS feeds right now. Please retry.'
      );
      setArticles([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFeed(category);
  }, [category]);

  useEffect(() => {
    onContextChange({
      source: 'Daily News & Current Affairs',
      title: `Live News (${category})`,
      summary: articles
        .slice(0, 6)
        .map((a) => `- ${a.title} (${a.source})`)
        .join('\n'),
    });
  }, [category, articles, onContextChange]);

  const formatAgo = (iso: string) => {
    try {
      const date = new Date(iso);
      const diffMs = Date.now() - date.getTime();
      const mins = Math.floor(diffMs / 60000);
      const hrs = Math.floor(diffMs / 3600000);
      if (mins < 60) return `${Math.max(1, mins)}m ago`;
      if (hrs < 24) return `${hrs}h ago`;
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    } catch {
      return 'Recently';
    }
  };

  const handleGenerateBrief = async (art: NewsArticle) => {
    if (briefs[art.id]) {
      setBriefs((prev) => {
        const copy = { ...prev };
        delete copy[art.id];
        return copy;
      });
      return;
    }

    setBriefLoadingId(art.id);
    setBriefErrorMap((prev) => ({ ...prev, [art.id]: '' }));
    try {
      const res = await generateNewsBrief({
        title: art.title,
        snippet: art.snippet,
        source: art.source,
        category: art.category,
        languageMode,
      });
      setBriefs((prev) => ({ ...prev, [art.id]: res }));
    } catch (err) {
      setBriefErrorMap((prev) => ({
        ...prev,
        [art.id]: err instanceof Error ? err.message : 'Failed to generate AI brief.',
      }));
    } finally {
      setBriefLoadingId(null);
    }
  };

  const filtered = articles.filter((a) => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      a.title.toLowerCase().includes(q) ||
      a.snippet.toLowerCase().includes(q) ||
      a.source.toLowerCase().includes(q)
    );
  });

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Header Banner */}
      <div className="bg-white dark:bg-[#0c1829] rounded-3xl p-5 sm:p-6 border border-sky-100 dark:border-sky-950/80 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-950 dark:bg-sky-600 text-white flex items-center justify-center shrink-0">
            <Newspaper className="w-5 h-5 text-sky-400 dark:text-white" />
          </div>
          <div>
            <h2 className="text-xl font-extrabold text-blue-950 dark:text-white tracking-tight">
              Daily News & Newspapers
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Live verified RSS headlines with one-click AI Current Affairs exam briefs and official newspaper portals.
            </p>
          </div>
        </div>

        <div className="inline-flex items-center bg-sky-50 dark:bg-[#081220] p-1 rounded-2xl border border-sky-100 dark:border-sky-950 self-start md:self-auto">
          <button
            type="button"
            onClick={() => setSubTab('live')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
              subTab === 'live'
                ? 'bg-blue-950 dark:bg-sky-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-blue-950 dark:hover:text-white'
            }`}
          >
            Live Headlines Feed
          </button>
          <button
            type="button"
            onClick={() => setSubTab('directory')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
              subTab === 'directory'
                ? 'bg-blue-950 dark:bg-sky-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-blue-950 dark:hover:text-white'
            }`}
          >
            Newspaper Directory (8)
          </button>
        </div>
      </div>

      {subTab === 'live' ? (
        <div className="space-y-5">
          {/* Controls */}
          <div className="bg-white dark:bg-[#0c1829] p-5 rounded-2xl border border-sky-100 dark:border-sky-950/80 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter headlines by keyword, state, topic, or source..."
                  className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-[#081220] rounded-xl border border-slate-200 dark:border-sky-950 text-xs text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-sky-400/30 font-medium"
                />
              </div>

              <button
                type="button"
                onClick={() => loadFeed(category, true)}
                disabled={loading}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-sky-50 dark:bg-[#081220] hover:bg-sky-100 dark:hover:bg-sky-950 text-blue-950 dark:text-sky-300 text-xs font-bold transition-colors border border-sky-200 dark:border-sky-900/60 shrink-0 cursor-pointer"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 text-sky-600 dark:text-sky-400 ${
                    loading ? 'animate-spin' : ''
                  }`}
                />
                <span>Refresh Feed</span>
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {CATEGORIES.map((c) => {
                const Icon = c.icon;
                const active = category === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setCategory(c.id)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
                      active
                        ? 'bg-blue-950 dark:bg-sky-600 text-white shadow-xs'
                        : 'bg-sky-50/70 dark:bg-[#081220] hover:bg-sky-100 dark:hover:bg-sky-950/60 text-slate-600 dark:text-slate-300 hover:text-blue-950 dark:hover:text-white'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{c.label}</span>
                  </button>
                );
              })}
            </div>

            {lastUpdated && (
              <div className="text-[11px] text-slate-400 dark:text-slate-500 pt-2 border-t border-slate-100 dark:border-sky-950/80 flex items-center justify-between tabular-nums">
                <span>Last synced: {new Date(lastUpdated).toLocaleTimeString()}</span>
                <span>{filtered.length} verified dispatches</span>
              </div>
            )}
          </div>

          {loading ? (
            <div className="bg-white dark:bg-[#0c1829] rounded-3xl p-12 text-center border border-sky-100 dark:border-sky-950/80 space-y-3">
              <Loader2 className="w-8 h-8 text-sky-600 dark:text-sky-400 animate-spin mx-auto" />
              <p className="text-sm font-bold text-slate-800 dark:text-white">
                Fetching live RSS dispatches...
              </p>
            </div>
          ) : error ? (
            <div className="bg-white dark:bg-[#0c1829] rounded-3xl p-8 border border-rose-200 dark:border-rose-900/70 text-center space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div className="max-w-md mx-auto">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Live Feed Temporarily Unavailable
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{error}</p>
              </div>
              <button
                type="button"
                onClick={() => loadFeed(category, true)}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-950 dark:bg-sky-600 text-white text-xs font-bold cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Retry Connection</span>
              </button>
            </div>
          ) : filtered.length === 0 ? (
            <div className="bg-white dark:bg-[#0c1829] rounded-3xl p-10 text-center border border-sky-100 dark:border-sky-950/80">
              <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
                No headlines match your search filter.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filtered.map((art) => {
                const brief = briefs[art.id];
                const isBriefLoading = briefLoadingId === art.id;
                const briefErr = briefErrorMap[art.id];
                const picked = mcqSelected[art.id];

                return (
                  <article
                    key={art.id}
                    className="bg-white dark:bg-[#0c1829] rounded-2xl p-5 border border-sky-100/90 dark:border-sky-950/80 shadow-2xs flex flex-col justify-between gap-4"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2 text-xs text-slate-400 dark:text-slate-500 font-semibold tabular-nums">
                        <span className="text-sky-700 dark:text-sky-400">{art.source}</span>
                        <span>{formatAgo(art.publishedAt)}</span>
                      </div>

                      <h3 className="text-base font-extrabold text-blue-950 dark:text-white leading-snug">
                        {art.title}
                      </h3>

                      <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed line-clamp-3">
                        {art.snippet}
                      </p>
                    </div>

                    {/* Interactive Brief Expansion */}
                    {briefErr && (
                      <p className="text-xs font-semibold text-rose-600 dark:text-rose-400">
                        {briefErr}
                      </p>
                    )}

                    {brief && (
                      <div className="p-4 rounded-2xl bg-sky-50/70 dark:bg-[#081220] border border-sky-200/80 dark:border-sky-900/80 space-y-3 text-xs">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-extrabold text-blue-950 dark:text-sky-300">
                            AI Current Affairs Exam Brief
                          </span>
                          <span className="font-semibold text-sky-700 dark:text-sky-400">
                            {brief.examRelevance}
                          </span>
                        </div>
                        <p className="text-slate-700 dark:text-slate-200 leading-relaxed">
                          {brief.summary}
                        </p>
                        <ul className="list-disc pl-4 space-y-1 text-slate-600 dark:text-slate-300">
                          {brief.keyPoints.map((pt, i) => (
                            <li key={i}>{pt}</li>
                          ))}
                        </ul>

                        {brief.practiceQuestion && (
                          <div className="pt-2.5 border-t border-sky-200/70 dark:border-sky-900/70 space-y-2">
                            <p className="font-bold text-slate-900 dark:text-white">
                              Quick Check: {brief.practiceQuestion.question}
                            </p>
                            <div className="space-y-1.5">
                              {brief.practiceQuestion.options.map((opt, oIdx) => {
                                const answered = picked !== undefined;
                                const isRight = oIdx === brief.practiceQuestion.correctIndex;
                                const isPicked = picked === oIdx;
                                let cls =
                                  'bg-white dark:bg-[#0c1829] border-slate-200 dark:border-sky-950 text-slate-700 dark:text-slate-200 hover:border-sky-400';
                                if (answered) {
                                  if (isRight) {
                                    cls =
                                      'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-400 text-emerald-900 dark:text-emerald-200 font-bold';
                                  } else if (isPicked) {
                                    cls =
                                      'bg-rose-50 dark:bg-rose-950/60 border-rose-400 text-rose-900 dark:text-rose-200 font-bold';
                                  }
                                }
                                return (
                                  <button
                                    key={oIdx}
                                    type="button"
                                    disabled={answered}
                                    onClick={() =>
                                      setMcqSelected((prev) => ({ ...prev, [art.id]: oIdx }))
                                    }
                                    className={`w-full p-2.5 rounded-xl border text-left flex items-center justify-between gap-2 transition-colors cursor-pointer disabled:cursor-default ${cls}`}
                                  >
                                    <span>
                                      {String.fromCharCode(65 + oIdx)}. {opt}
                                    </span>
                                    {answered && isRight && (
                                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                                    )}
                                    {answered && isPicked && !isRight && (
                                      <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                            {picked !== undefined && (
                              <p className="text-[11px] text-slate-600 dark:text-slate-300">
                                <strong className="text-blue-950 dark:text-sky-300">Answer: </strong>
                                {brief.practiceQuestion.explanation}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Action Row */}
                    <div className="pt-3 border-t border-slate-100 dark:border-sky-950/80 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={isBriefLoading}
                          onClick={() => handleGenerateBrief(art)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-950 dark:bg-sky-600 hover:bg-sky-600 dark:hover:bg-sky-500 text-white text-xs font-bold transition-colors cursor-pointer"
                        >
                          {isBriefLoading ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Sparkles className="w-3.5 h-3.5 text-sky-300 dark:text-white" />
                          )}
                          <span>{brief ? 'Hide AI Brief' : 'AI Exam Brief'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            onDiscussInAssistant(
                              `Explain the background and exam significance of this current news headline:\n\n"${art.title}" (${art.source})\n${art.snippet}`
                            )
                          }
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sky-50 dark:bg-[#081220] hover:bg-sky-100 dark:hover:bg-sky-950 text-blue-950 dark:text-sky-300 border border-sky-200 dark:border-sky-900/70 text-xs font-bold transition-colors cursor-pointer"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                          <span>Discuss</span>
                        </button>
                      </div>

                      <a
                        href={art.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-sky-600 dark:hover:text-sky-400 transition-colors"
                      >
                        <span>Full Story</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* Newspaper Directory */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {NEWSPAPER_DIRECTORY.map((paper) => (
            <div
              key={paper.id}
              className="bg-white dark:bg-[#0c1829] rounded-2xl p-5 border border-sky-100/90 dark:border-sky-950/80 shadow-2xs flex flex-col justify-between gap-4"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2 text-xs font-semibold">
                  <span className={paper.tagColor}>{paper.badge}</span>
                  <span className="text-slate-400 dark:text-slate-500">{paper.region}</span>
                </div>
                <h3 className="text-lg font-extrabold text-blue-950 dark:text-white flex items-baseline gap-2">
                  <span>{paper.name}</span>
                  {paper.nativeName && (
                    <span className="text-sm font-bold text-sky-600 dark:text-sky-400">
                      {paper.nativeName}
                    </span>
                  )}
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  {paper.description}
                </p>
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-sky-950/80 flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  {paper.language} Edition
                </span>
                <a
                  href={paper.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-950 dark:bg-sky-600 hover:bg-sky-600 dark:hover:bg-sky-500 text-white text-xs font-bold transition-colors"
                >
                  <span>Visit Portal</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
