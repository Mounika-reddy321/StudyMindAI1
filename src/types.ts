export type TabId = 'assistant' | 'history' | 'library' | 'notes' | 'exam' | 'news';

export type LanguageMode = 'Simple English' | 'Telugu' | 'Telugu + English';

export type NoteType = 'detailed' | 'concise' | 'exam-oriented';

export type Difficulty = 'Easy' | 'Medium' | 'Hard';

export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  role: string;
  isGuest?: boolean;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  followUps?: string[];
}

export interface Conversation {
  id: string;
  userId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: ChatMessage[];
}

export interface Story {
  id: number;
  title: string;
  category: string;
  language: string;
  readingTime: string;
  shortDescription: string;
  content: string;
  moral: string;
  tags: string[];
  isCustom?: boolean;
}

export interface Flashcard {
  front: string;
  back: string;
}

export interface SavedNote {
  id: string;
  userId: string;
  title: string;
  topic: string;
  noteType: NoteType;
  languageMode: LanguageMode;
  content: string;
  flashcards?: Flashcard[];
  createdAt: string;
}

export interface ExamQuestion {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export interface ExamAttemptDetail {
  question: string;
  selectedAnswer: string;
  correctAnswer: string;
  isCorrect: boolean;
}

export interface ExamAttempt {
  id: string;
  userId: string;
  subject: string;
  topic: string;
  difficulty: Difficulty;
  score: number;
  total: number;
  percentage: number;
  completedAt: string;
  details: ExamAttemptDetail[];
}

export interface NewsArticle {
  id: string;
  title: string;
  snippet: string;
  link: string;
  source: string;
  category: string;
  publishedAt: string;
}

export interface NewspaperPortal {
  id: string;
  name: string;
  nativeName?: string;
  language: string;
  region: string;
  url: string;
  description: string;
  badge: string;
  tagColor: string;
}

export interface ActiveStudyContext {
  source: string;
  title: string;
  summary: string;
}
