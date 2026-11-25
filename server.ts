import 'dotenv/config';
import express, { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MODEL = 'gemini-4-hydrogen';

function getAI(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      'GEMINI_API_KEY is not configured. Please check the Settings > Secrets panel.'
    );
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function getLanguageInstruction(languageMode?: string): string {
  switch (languageMode) {
    case 'Telugu':
      return 'Respond strictly in clear, natural, student-friendly Telugu script (తెలుగు). Use simple academic Telugu terms and keep technical symbols or code readable.';
    case 'Telugu + English':
      return 'Respond in clear Bilingual mode (Telugu + English). Explain core concepts in simple English first, followed by helpful Telugu explanations (తెలుగులో వివరణ) and key terms in both languages so Indian students grasp them effortlessly.';
    default:
      return 'Respond in clear, simple, well-structured English suitable for students. Use analogies, concise paragraphs, bullet points, and clear formatting.';
  }
}

async function withRetry<T>(fn: () => Promise<T>, retries = 2): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err: unknown) {
      lastErr = err;
      const msg = err instanceof Error ? err.message : String(err);
      const isTransient =
        msg.includes('503') ||
        msg.includes('429') ||
        msg.includes('UNAVAILABLE') ||
        msg.includes('RESOURCE_EXHAUSTED') ||
        msg.includes('overloaded');
      if (!isTransient || attempt === retries) {
        throw err;
      }
      await new Promise((r) => setTimeout(r, 700 * (attempt + 1)));
    }
  }
  throw lastErr;
}

function formatApiError(err: unknown): { status: number; message: string } {
  const raw = err instanceof Error ? err.message : String(err);
  if (raw.includes('GEMINI_API_KEY is not configured')) {
    return { status: 500, message: raw };
  }
  if (raw.includes('API_KEY_INVALID') || raw.includes('PERMISSION_DENIED') || raw.includes('403')) {
    return {
      status: 403,
      message:
        'Your Gemini API key appears invalid or lacks permission. Please verify it in the Settings > Secrets panel.',
    };
  }
  if (raw.includes('RESOURCE_EXHAUSTED') || raw.includes('429')) {
    return {
      status: 429,
      message:
        'Rate limit temporarily reached. Please wait a few seconds and try again.',
    };
  }
  if (raw.includes('503') || raw.includes('UNAVAILABLE')) {
    return {
      status: 503,
      message:
        'AI servers are briefly busy. Please retry your request in a moment.',
    };
  }
  return { status: 500, message: raw || 'An unexpected error occurred.' };
}

function safeParseJson<T>(text: string | undefined, fallback: T): T {
  if (!text) return fallback;
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed) as T;
  } catch {
    const cleaned = trimmed
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/, '')
      .trim();
    try {
      return JSON.parse(cleaned) as T;
    } catch {
      return fallback;
    }
  }
}

// ============================================================
// LIVE RSS NEWS FETCHER & PARSER
// ============================================================
interface RssFeedSource {
  url: string;
  source: string;
  category: string;
}

const RSS_FEEDS: Record<string, RssFeedSource[]> = {
  india: [
    { url: 'https://www.thehindu.com/news/national/feeder/default.rss', source: 'The Hindu', category: 'india' },
    { url: 'https://indianexpress.com/section/india/feed/', source: 'The Indian Express', category: 'india' },
    { url: 'https://timesofindia.indiatimes.com/rssfeeds/-2128936835.cms', source: 'Times of India', category: 'india' },
  ],
  'ap-ts': [
    { url: 'https://www.thehindu.com/news/national/andhra-pradesh/feeder/default.rss', source: 'The Hindu (AP)', category: 'ap-ts' },
    { url: 'https://www.thehindu.com/news/national/telangana/feeder/default.rss', source: 'The Hindu (Telangana)', category: 'ap-ts' },
    { url: 'https://news.google.com/rss/search?q=Andhra+Pradesh+OR+Telangana+when:2d&hl=en-IN&gl=IN&ceid=IN:en', source: 'Regional Wire', category: 'ap-ts' },
  ],
  world: [
    { url: 'https://feeds.bbci.co.uk/news/world/rss.xml', source: 'BBC News', category: 'world' },
    { url: 'https://www.thehindu.com/news/international/feeder/default.rss', source: 'The Hindu', category: 'world' },
  ],
  technology: [
    { url: 'https://feeds.bbci.co.uk/news/technology/rss.xml', source: 'BBC Tech', category: 'technology' },
    { url: 'https://indianexpress.com/section/technology/feed/', source: 'Indian Express Tech', category: 'technology' },
  ],
  education: [
    { url: 'https://www.thehindu.com/education/feeder/default.rss', source: 'The Hindu Education', category: 'education' },
    { url: 'https://indianexpress.com/section/education/feed/', source: 'Indian Express Education', category: 'education' },
    { url: 'https://news.google.com/rss/search?q=UPSC+OR+APPSC+OR+TSPSC+OR+JEE+OR+NEET+education+India&hl=en-IN&gl=IN&ceid=IN:en', source: 'Education Desk', category: 'education' },
  ],
  science: [
    { url: 'https://feeds.bbci.co.uk/news/science_and_environment/rss.xml', source: 'BBC Science', category: 'science' },
    { url: 'https://www.thehindu.com/sci-tech/science/feeder/default.rss', source: 'The Hindu Science', category: 'science' },
  ],
};

interface ParsedArticle {
  id: string;
  title: string;
  snippet: string;
  link: string;
  source: string;
  category: string;
  publishedAt: string;
}

const newsCache = new Map<string, { articles: ParsedArticle[]; lastUpdated: string; expiresAt: number }>();

function decodeEntities(input: string): string {
  return input
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractTag(block: string, tag: string): string {
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i');
  const match = block.match(regex);
  return match ? decodeEntities(match[1]) : '';
}

function parseRssXml(xml: string, defaultSource: string, category: string): ParsedArticle[] {
  const items: ParsedArticle[] = [];
  const itemMatches = xml.match(/<item[\s>][\s\S]*?<\/item>/gi) || [];

  for (let i = 0; i < Math.min(itemMatches.length, 10); i++) {
    const item = itemMatches[i];
    const title = extractTag(item, 'title');
    const link = extractTag(item, 'link');
    const description = extractTag(item, 'description');
    const pubDate = extractTag(item, 'pubDate');
    const sourceTag = extractTag(item, 'source');

    if (!title || !link) continue;

    let publishedAt = new Date().toISOString();
    if (pubDate) {
      const parsed = new Date(pubDate);
      if (!Number.isNaN(parsed.getTime())) {
        publishedAt = parsed.toISOString();
      }
    }

    items.push({
      id: `${category}_${i}_${Buffer.from(title.slice(0, 32)).toString('base64').replace(/[^a-zA-Z0-9]/g, '')}`,
      title,
      snippet: description.slice(0, 240) || `Read the full report on ${sourceTag || defaultSource}.`,
      link,
      source: sourceTag || defaultSource,
      category,
      publishedAt,
    });
  }
  return items;
}

async function fetchCategoryNews(category: string, forceRefresh = false): Promise<{ articles: ParsedArticle[]; lastUpdated: string }> {
  const cat = category in RSS_FEEDS || category === 'all' ? category : 'all';
  const cached = newsCache.get(cat);
  if (!forceRefresh && cached && cached.expiresAt > Date.now()) {
    return { articles: cached.articles, lastUpdated: cached.lastUpdated };
  }

  const sources: RssFeedSource[] =
    cat === 'all'
      ? [
          RSS_FEEDS.india[0],
          RSS_FEEDS['ap-ts'][0],
          RSS_FEEDS['ap-ts'][1],
          RSS_FEEDS.world[0],
          RSS_FEEDS.technology[0],
          RSS_FEEDS.education[0],
          RSS_FEEDS.science[0],
        ]
      : RSS_FEEDS[cat];

  const results = await Promise.allSettled(
    sources.map(async (feed) => {
      const resp = await fetch(feed.url, {
        headers: {
          'User-Agent': 'StudyMindAI-NewsReader/1.0 (+https://studymind.ai)',
          Accept: 'application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8',
        },
        signal: AbortSignal.timeout(6500),
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const xml = await resp.text();
      return parseRssXml(xml, feed.source, feed.category);
    })
  );

  const seen = new Set<string>();
  const merged: ParsedArticle[] = [];

  for (const res of results) {
    if (res.status === 'fulfilled') {
      for (const art of res.value) {
        const key = art.title.toLowerCase().slice(0, 60);
        if (!seen.has(key)) {
          seen.add(key);
          merged.push(art);
        }
      }
    }
  }

  merged.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
  const finalArticles = merged.slice(0, 28);
  const lastUpdated = new Date().toISOString();

  if (finalArticles.length > 0) {
    newsCache.set(cat, {
      articles: finalArticles,
      lastUpdated,
      expiresAt: Date.now() + 5 * 60 * 1000,
    });
  }

  return { articles: finalArticles, lastUpdated };
}

// ============================================================
// EXPRESS SERVER
// ============================================================
async function startServer() {
  const app = express();
  app.use(express.json({ limit: '20mb' }));

  // 1. Health check
  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({
      ok: true,
      hasKey: Boolean(process.env.GEMINI_API_KEY),
      model: MODEL,
    });
  });

  // 2. Streaming Interactive Chat Endpoint (SSE)
  app.post('/api/chat/stream', async (req: Request, res: Response) => {
    const { messages, languageMode, context } = req.body as {
      messages?: Array<{ role: 'user' | 'assistant'; content: string }>;
      languageMode?: string;
      context?: { source: string; title: string; summary: string } | null;
    };

    if (!Array.isArray(messages) || messages.length === 0) {
      res.status(400).json({ error: 'Please provide a question or message.' });
      return;
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    const sendEvent = (payload: Record<string, unknown>) => {
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
    };

    try {
      const ai = getAI();
      const contextBlock = context
        ? `\n\nActive Study Context from the user's current screen (${context.source} — "${context.title}"):\n${context.summary.slice(0, 3000)}\nUse this context directly if the user's question refers to it.`
        : '';

      const systemInstruction = `You are StudyMind AI, a warm, super-responsive personal study tutor helping learners master academics, competitive exams (UPSC, APPSC, TSPSC, JEE, NEET), programming, science, and languages.
${getLanguageInstruction(languageMode)}
Formatting & Pedagogy rules:
- Be interactive, encouraging, and crystal clear.
- Break complex concepts into logical steps, clean headings, bullet points, or worked examples.
- For coding questions, provide clean, commented code blocks and explain time/space complexity.
- End naturally with a brief interactive check-in or invitation to explore deeper.${contextBlock}`;

      const contents = messages.slice(-16).map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }));

      let fullText = '';

      const stream = await withRetry(() =>
        ai.models.generateContentStream({
          model: MODEL,
          contents,
          config: {
            systemInstruction,
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          },
        })
      );

      for await (const chunk of stream) {
        const delta = chunk.text;
        if (delta) {
          fullText += delta;
          sendEvent({ chunk: delta });
        }
      }

      // Generate 3 clickable interactive follow-up prompts quickly
      let followUps: string[] = [];
      try {
        const lastUserMsg = messages[messages.length - 1]?.content || '';
        const followUpResp = await ai.models.generateContent({
          model: MODEL,
          contents: `Based on this student question: "${lastUserMsg.slice(0, 300)}" and tutor answer: "${fullText.slice(0, 600)}", suggest 3 short, engaging next follow-up questions the student can click to keep learning interactively. ${getLanguageInstruction(languageMode)}`,
          config: {
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                followUps: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: 'Exactly 3 concise, clickable follow-up prompts (under 12 words each).',
                },
              },
              required: ['followUps'],
            },
          },
        });
        const parsed = safeParseJson<{ followUps?: string[] }>(followUpResp.text, {});
        if (Array.isArray(parsed.followUps)) {
          followUps = parsed.followUps.slice(0, 3);
        }
      } catch {
        // Non-blocking: main answer already streamed cleanly
      }

      sendEvent({ done: true, followUps });
      res.end();
    } catch (err) {
      const { message } = formatApiError(err);
      sendEvent({ error: message });
      res.end();
    }
  });

  // 3. Non-streaming Chat Endpoint
  app.post('/api/chat', async (req: Request, res: Response) => {
    const { messages, languageMode, context } = req.body as {
      messages?: Array<{ role: 'user' | 'assistant'; content: string }>;
      languageMode?: string;
      context?: { source: string; title: string; summary: string } | null;
    };

    if (!Array.isArray(messages) || messages.length === 0) {
      res.status(400).json({ error: 'Messages array is required.' });
      return;
    }

    try {
      const ai = getAI();
      const contextBlock = context
        ? `\n\nActive Study Context (${context.source} — "${context.title}"):\n${context.summary.slice(0, 3000)}`
        : '';

      const contents = messages.slice(-16).map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }));

      const response = await withRetry(() =>
        ai.models.generateContent({
          model: MODEL,
          contents,
          config: {
            systemInstruction: `You are StudyMind AI, a helpful and interactive study tutor. ${getLanguageInstruction(languageMode)}${contextBlock}`,
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          },
        })
      );

      res.json({ reply: response.text || 'I could not generate an answer. Please try again.' });
    } catch (err) {
      const { status, message } = formatApiError(err);
      res.status(status).json({ error: message });
    }
  });

  // 4. Extract PDF / Document Text using Gemini Multimodal Native PDF Understanding
  app.post('/api/extract-pdf', async (req: Request, res: Response) => {
    const { base64Data, fileName } = req.body as {
      base64Data?: string;
      fileName?: string;
    };

    if (!base64Data) {
      res.status(400).json({ error: 'No PDF file payload received.' });
      return;
    }

    try {
      const ai = getAI();
      const match = base64Data.match(/^data:([^;]+);base64,(.+)$/);
      const mimeType = match ? match[1] : 'application/pdf';
      const rawBase64 = match ? match[2] : base64Data;

      const response = await withRetry(() =>
        ai.models.generateContent({
          model: MODEL,
          contents: {
            parts: [
              {
                inlineData: {
                  mimeType,
                  data: rawBase64,
                },
              },
              {
                text: `Extract all readable study text, headings, formulas, definitions, and key points cleanly from this document (${fileName || 'study_document.pdf'}). Return JSON with the extracted text and estimated number of pages.`,
              },
            ],
          },
          config: {
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                text: {
                  type: Type.STRING,
                  description: 'Clean extracted text from the document.',
                },
                pages: {
                  type: Type.INTEGER,
                  description: 'Estimated number of pages in the document.',
                },
              },
              required: ['text', 'pages'],
            },
          },
        })
      );

      const parsed = safeParseJson<{ text?: string; pages?: number }>(response.text, {});
      const extractedText = (parsed.text || '').trim();

      if (!extractedText) {
        res.status(422).json({
          error: 'Could not extract readable text from this document. Please check that the file is legible.',
        });
        return;
      }

      res.json({
        text: extractedText,
        pages: Math.max(1, parsed.pages || 1),
        textLength: extractedText.length,
      });
    } catch (err) {
      const { status, message } = formatApiError(err);
      res.status(status).json({ error: message });
    }
  });

  // 5. Smart Notes Generator (+ Interactive Flashcards)
  app.post('/api/generate-notes', async (req: Request, res: Response) => {
    const { topic, content, languageMode, noteType } = req.body as {
      topic?: string;
      content?: string;
      languageMode?: string;
      noteType?: string;
    };

    if (!topic?.trim() && !content?.trim()) {
      res.status(400).json({ error: 'Please provide a topic or study material content.' });
      return;
    }

    const depthInstruction =
      noteType === 'concise'
        ? 'Format as a high-yield quick-revision cheat sheet: crisp bullet points, key definitions, and rapid recall takeaways.'
        : noteType === 'exam-oriented'
        ? 'Format as exam-oriented preparation notes: key formulas/dates/articles, comparison tables, frequently tested traps, and 5 short-answer practice questions with model answers.'
        : 'Format as comprehensive, textbook-grade academic study notes with structured Markdown headings, clear explanations, examples, key terms, and a final revision checklist.';

    try {
      const ai = getAI();
      const response = await withRetry(() =>
        ai.models.generateContent({
          model: MODEL,
          contents: `Topic: ${topic || 'Provided Study Material'}\n\nSource Material / Syllabus:\n${
            content ? content.slice(0, 18000) : 'Generate authoritative academic notes directly from your knowledge of this topic.'
          }`,
          config: {
            systemInstruction: `You are an expert academic note-maker for StudyMind AI.
${getLanguageInstruction(languageMode)}
${depthInstruction}
Return structured JSON containing the rich Markdown notes and 6 interactive study flashcards for active recall.`,
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                notes: {
                  type: Type.STRING,
                  description: 'Well-formatted Markdown academic notes.',
                },
                flashcards: {
                  type: Type.ARRAY,
                  description: '6 active-recall flashcards based on the notes.',
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      front: { type: Type.STRING, description: 'Question, term, or concept prompt.' },
                      back: { type: Type.STRING, description: 'Clear, concise answer or definition.' },
                    },
                    required: ['front', 'back'],
                  },
                },
              },
              required: ['notes', 'flashcards'],
            },
          },
        })
      );

      const parsed = safeParseJson<{
        notes?: string;
        flashcards?: Array<{ front: string; back: string }>;
      }>(response.text, {});

      if (!parsed.notes) {
        res.status(502).json({ error: 'AI returned an empty note response. Please try again.' });
        return;
      }

      res.json({
        notes: parsed.notes,
        flashcards: Array.isArray(parsed.flashcards) ? parsed.flashcards : [],
      });
    } catch (err) {
      const { status, message } = formatApiError(err);
      res.status(status).json({ error: message });
    }
  });

  // 6. Interactive Exam Simulator Generator
  app.post('/api/generate-exam', async (req: Request, res: Response) => {
    const { subject, topic, difficulty, questionCount, languageMode, sourceNotes } = req.body as {
      subject?: string;
      topic?: string;
      difficulty?: string;
      questionCount?: number;
      languageMode?: string;
      sourceNotes?: string;
    };

    if (!topic?.trim() && !sourceNotes?.trim()) {
      res.status(400).json({ error: 'Please specify an exam topic.' });
      return;
    }

    const count = Math.min(15, Math.max(3, Number(questionCount) || 5));

    try {
      const ai = getAI();
      const response = await withRetry(() =>
        ai.models.generateContent({
          model: MODEL,
          contents: `Create a ${count}-question multiple-choice practice exam.
Subject: ${subject || 'General Studies'}
Topic: ${topic || 'Study Notes Assessment'}
Difficulty: ${difficulty || 'Medium'}
${sourceNotes ? `\nBase questions strictly on these study notes:\n${sourceNotes.slice(0, 12000)}` : ''}`,
          config: {
            systemInstruction: `You are an expert exam question setter for competitive and academic exams.
${getLanguageInstruction(languageMode)}
Rules:
- Generate exactly ${count} distinct, accurate, non-trivial MCQs.
- Every question MUST have exactly 4 plausible options (no "All of the above" laziness unless truly appropriate).
- correctIndex MUST be 0, 1, 2, or 3 matching the right option in the options array.
- explanation MUST clearly explain why the correct option is right and clarify common misconceptions.`,
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                questions: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      question: { type: Type.STRING },
                      options: {
                        type: Type.ARRAY,
                        items: { type: Type.STRING },
                      },
                      correctIndex: { type: Type.INTEGER },
                      explanation: { type: Type.STRING },
                    },
                    required: ['question', 'options', 'correctIndex', 'explanation'],
                  },
                },
              },
              required: ['questions'],
            },
          },
        })
      );

      const parsed = safeParseJson<{
        questions?: Array<{
          question: string;
          options: string[];
          correctIndex: number;
          explanation: string;
        }>;
      }>(response.text, {});

      const validQuestions = (parsed.questions || [])
        .filter((q) => q.question && Array.isArray(q.options) && q.options.length >= 2)
        .map((q) => ({
          question: q.question,
          options: q.options.slice(0, 4),
          correctIndex: Math.min(
            q.options.slice(0, 4).length - 1,
            Math.max(0, Number(q.correctIndex) || 0)
          ),
          explanation: q.explanation || 'Review the core concept for this topic.',
        }));

      if (validQuestions.length === 0) {
        res.status(502).json({ error: 'Could not generate valid exam questions. Please retry.' });
        return;
      }

      res.json({ questions: validQuestions });
    } catch (err) {
      const { status, message } = formatApiError(err);
      res.status(status).json({ error: message });
    }
  });

  // 7. Interactive Exam Question Deep-Dive Tutor
  app.post('/api/explain-question', async (req: Request, res: Response) => {
    const { question, options, correctAnswer, userAnswer, languageMode, followUp } = req.body as {
      question?: string;
      options?: string[];
      correctAnswer?: string;
      userAnswer?: string;
      languageMode?: string;
      followUp?: string;
    };

    if (!question) {
      res.status(400).json({ error: 'Question details are required.' });
      return;
    }

    try {
      const ai = getAI();
      const response = await withRetry(() =>
        ai.models.generateContent({
          model: MODEL,
          contents: `Question: ${question}
Options: ${(options || []).join(' | ')}
Correct Answer: ${correctAnswer}
Student Selected: ${userAnswer || 'Not answered'}
${followUp ? `Student's specific doubt: ${followUp}` : 'Explain this step-by-step with a simple real-world example and a quick memory tip so the student never forgets it.'}`,
          config: {
            systemInstruction: `You are StudyMind AI's interactive exam coach. ${getLanguageInstruction(languageMode)} Keep the explanation concise, crystal-clear, and encouraging.`,
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          },
        })
      );

      res.json({ explanation: response.text || 'Unable to explain right now.' });
    } catch (err) {
      const { status, message } = formatApiError(err);
      res.status(status).json({ error: message });
    }
  });

  // 8. Interactive Story Companion & Custom Story Generator
  app.post('/api/story-interact', async (req: Request, res: Response) => {
    const { action, story, languageMode, question, customTheme, customLanguage } = req.body as {
      action?: 'translate' | 'quiz' | 'vocabulary' | 'ask' | 'create';
      story?: { title: string; content: string; moral: string; language: string; category: string };
      languageMode?: string;
      question?: string;
      customTheme?: string;
      customLanguage?: string;
    };

    try {
      const ai = getAI();

      if (action === 'create') {
        const theme = (customTheme || 'A young student overcoming self-doubt in a coastal town').trim();
        const lang = customLanguage || 'English';
        const response = await withRetry(() =>
          ai.models.generateContent({
            model: MODEL,
            contents: `Write an original, emotionally rich, engaging audio story based on this prompt: "${theme}".
Language: ${lang === 'Telugu' ? 'Natural, expressive Telugu script (తెలుగు)' : lang === 'Telugu + English' ? 'Bilingual English with expressive Telugu dialogue & moral' : 'Warm, vivid English suitable for listening aloud'}.
Length: around 220-320 words, divided into 3-4 smooth paragraphs.`,
            config: {
              thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
              responseMimeType: 'application/json',
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  category: { type: Type.STRING },
                  language: { type: Type.STRING },
                  readingTime: { type: Type.STRING },
                  shortDescription: { type: Type.STRING },
                  content: { type: Type.STRING },
                  moral: { type: Type.STRING },
                  tags: { type: Type.ARRAY, items: { type: Type.STRING } },
                },
                required: ['title', 'category', 'language', 'readingTime', 'shortDescription', 'content', 'moral', 'tags'],
              },
            },
          })
        );

        const created = safeParseJson(response.text, null);
        if (!created) {
          res.status(502).json({ error: 'Could not create story. Please try again.' });
          return;
        }
        res.json({ story: created });
        return;
      }

      if (!story) {
        res.status(400).json({ error: 'Story context is required.' });
        return;
      }

      if (action === 'quiz') {
        const response = await withRetry(() =>
          ai.models.generateContent({
            model: MODEL,
            contents: `Create 3 engaging comprehension & moral-reasoning multiple-choice questions for the story "${story.title}":\n\n${story.content}\n\nMoral: ${story.moral}`,
            config: {
              systemInstruction: getLanguageInstruction(languageMode),
              thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
              responseMimeType: 'application/json',
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  questions: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        question: { type: Type.STRING },
                        options: { type: Type.ARRAY, items: { type: Type.STRING } },
                        correctIndex: { type: Type.INTEGER },
                        explanation: { type: Type.STRING },
                      },
                      required: ['question', 'options', 'correctIndex', 'explanation'],
                    },
                  },
                },
                required: ['questions'],
              },
            },
          })
        );
        const parsed = safeParseJson<{ questions?: unknown[] }>(response.text, { questions: [] });
        res.json({ questions: parsed.questions || [] });
        return;
      }

      let prompt = '';
      if (action === 'translate') {
        const target = story.language.toLowerCase().includes('telugu') ? 'clear, expressive English' : 'natural, warm Telugu (తెలుగు)';
        prompt = `Translate the following story titled "${story.title}" faithfully into ${target}, preserving its emotion and ending with the translated moral:\n\n${story.content}\n\nMoral: ${story.moral}`;
      } else if (action === 'vocabulary') {
        prompt = `Analyze the story "${story.title}" for learners:
1. List 6 rich vocabulary words or expressions from the story with simple meanings and example sentences.
2. Explain the deeper life lesson in 2 concise sentences.
${getLanguageInstruction(languageMode)}

Story:\n${story.content}`;
      } else {
        prompt = `Story "${story.title}":\n${story.content}\nMoral: ${story.moral}\n\nStudent's question: ${question || 'What is the main theme of this story?'}`;
      }

      const response = await withRetry(() =>
        ai.models.generateContent({
          model: MODEL,
          contents: prompt,
          config: {
            systemInstruction: `You are StudyMind AI's interactive storytelling companion. ${getLanguageInstruction(languageMode)}`,
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          },
        })
      );

      res.json({ reply: response.text || 'No response generated.' });
    } catch (err) {
      const { status, message } = formatApiError(err);
      res.status(status).json({ error: message });
    }
  });

  // 9. Live Daily News RSS Aggregator
  app.get('/api/news', async (req: Request, res: Response) => {
    const category = String(req.query.category || 'all');
    const forceRefresh = req.query.refresh === 'true';

    try {
      const data = await fetchCategoryNews(category, forceRefresh);
      if (data.articles.length === 0) {
        res.status(503).json({
          error: 'Could not reach external RSS news servers right now. Try refreshing in a moment.',
        });
        return;
      }
      res.json(data);
    } catch (err) {
      const { status, message } = formatApiError(err);
      res.status(status).json({ error: message });
    }
  });

  // 10. Interactive AI Current Affairs Exam Brief for any News Headline
  app.post('/api/news-brief', async (req: Request, res: Response) => {
    const { title, snippet, source, category, languageMode } = req.body as {
      title?: string;
      snippet?: string;
      source?: string;
      category?: string;
      languageMode?: string;
    };

    if (!title) {
      res.status(400).json({ error: 'Headline title is required.' });
      return;
    }

    try {
      const ai = getAI();
      const response = await withRetry(() =>
        ai.models.generateContent({
          model: MODEL,
          contents: `Analyze this current news headline for students & competitive exam aspirants (UPSC / APPSC / TSPSC / General Awareness):
Headline: ${title}
Summary snippet: ${snippet || ''}
Source: ${source || 'Verified News'}
Category: ${category || 'General'}`,
          config: {
            systemInstruction: `You are a Current Affairs mentor for StudyMind AI. ${getLanguageInstruction(languageMode)}
Provide a factual, objective, exam-relevant breakdown without inventing unverified statistics.`,
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                summary: { type: Type.STRING, description: 'Clear 2-3 sentence student-friendly context summary.' },
                keyPoints: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: '3-4 concise exam-oriented key takeaways or concepts to remember.',
                },
                examRelevance: {
                  type: Type.STRING,
                  description: 'Which exam syllabus paper or subject this relates to (e.g., Polity, Economy, Science & Tech).',
                },
                practiceQuestion: {
                  type: Type.OBJECT,
                  properties: {
                    question: { type: Type.STRING },
                    options: { type: Type.ARRAY, items: { type: Type.STRING } },
                    correctIndex: { type: Type.INTEGER },
                    explanation: { type: Type.STRING },
                  },
                  required: ['question', 'options', 'correctIndex', 'explanation'],
                },
              },
              required: ['summary', 'keyPoints', 'examRelevance', 'practiceQuestion'],
            },
          },
        })
      );

      const parsed = safeParseJson(response.text, null);
      if (!parsed) {
        res.status(502).json({ error: 'Could not generate news brief. Please retry.' });
        return;
      }
      res.json(parsed);
    } catch (err) {
      const { status, message } = formatApiError(err);
      res.status(status).json({ error: message });
    }
  });

  // Static / Vite middleware
  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const PORT = Number(process.env.PORT) || 3000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`StudyMind AI server running at http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start StudyMind AI server:', err);
  process.exit(1);
});
