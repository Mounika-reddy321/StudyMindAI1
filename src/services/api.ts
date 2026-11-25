import {
  ActiveStudyContext,
  Difficulty,
  ExamQuestion,
  Flashcard,
  LanguageMode,
  NewsArticle,
  NoteType,
  Story,
} from '../types';

export interface StreamChatParams {
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  languageMode: LanguageMode;
  context?: ActiveStudyContext | null;
  onChunk: (delta: string) => void;
  onFollowUps?: (followUps: string[]) => void;
  signal?: AbortSignal;
}

export async function streamChat({
  messages,
  languageMode,
  context,
  onChunk,
  onFollowUps,
  signal,
}: StreamChatParams): Promise<string> {
  const response = await fetch('/api/chat/stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, languageMode, context }),
    signal,
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error || `Request failed (${response.status})`);
  }

  if (!response.body) {
    throw new Error('Streaming response body is unavailable.');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let fullText = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line.startsWith('data:')) continue;
      const jsonStr = line.slice(5).trim();
      if (!jsonStr) continue;
      try {
        const evt = JSON.parse(jsonStr) as {
          chunk?: string;
          followUps?: string[];
          done?: boolean;
          error?: string;
        };
        if (evt.error) {
          throw new Error(evt.error);
        }
        if (evt.chunk) {
          fullText += evt.chunk;
          onChunk(evt.chunk);
        }
        if (Array.isArray(evt.followUps) && onFollowUps) {
          onFollowUps(evt.followUps);
        }
      } catch (e) {
        if (e instanceof Error && !e.message.includes('JSON')) {
          throw e;
        }
      }
    }
  }

  return fullText;
}

export async function extractPdfText(
  base64Data: string,
  fileName: string
): Promise<{ text: string; pages: number; textLength: number }> {
  const res = await fetch('/api/extract-pdf', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ base64Data, fileName }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'Failed to extract text from PDF.');
  }
  return data;
}

export async function generateStudyNotes(params: {
  topic: string;
  content: string;
  languageMode: LanguageMode;
  noteType: NoteType;
}): Promise<{ notes: string; flashcards: Flashcard[] }> {
  const res = await fetch('/api/generate-notes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'Failed to generate study notes.');
  }
  return data;
}

export async function generatePracticeExam(params: {
  subject: string;
  topic: string;
  difficulty: Difficulty;
  questionCount: number;
  languageMode: LanguageMode;
  sourceNotes?: string;
}): Promise<{ questions: ExamQuestion[] }> {
  const res = await fetch('/api/generate-exam', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'Failed to generate practice exam.');
  }
  return data;
}

export async function explainExamQuestion(params: {
  question: string;
  options: string[];
  correctAnswer: string;
  userAnswer: string;
  languageMode: LanguageMode;
  followUp?: string;
}): Promise<{ explanation: string }> {
  const res = await fetch('/api/explain-question', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'Could not explain this question.');
  }
  return data;
}

export async function interactWithStory(params: {
  action: 'translate' | 'quiz' | 'vocabulary' | 'ask' | 'create';
  story?: Story;
  languageMode?: LanguageMode;
  question?: string;
  customTheme?: string;
  customLanguage?: string;
}): Promise<{ reply?: string; questions?: ExamQuestion[]; story?: Omit<Story, 'id'> }> {
  const res = await fetch('/api/story-interact', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'Story AI request failed.');
  }
  return data;
}

export async function fetchNewsFeed(
  category: string,
  refresh = false
): Promise<{ articles: NewsArticle[]; lastUpdated: string }> {
  const res = await fetch(
    `/api/news?category=${encodeURIComponent(category)}${refresh ? '&refresh=true' : ''}`
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'Failed to load live news.');
  }
  return data;
}

export interface NewsBriefResult {
  summary: string;
  keyPoints: string[];
  examRelevance: string;
  practiceQuestion: ExamQuestion;
}

export async function generateNewsBrief(params: {
  title: string;
  snippet: string;
  source: string;
  category: string;
  languageMode: LanguageMode;
}): Promise<NewsBriefResult> {
  const res = await fetch('/api/news-brief', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'Failed to generate Current Affairs brief.');
  }
  return data;
}
