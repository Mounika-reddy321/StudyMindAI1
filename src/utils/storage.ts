import { Conversation, ExamAttempt, SavedNote, Story, UserProfile } from '../types';

const KEYS = {
  CURRENT_USER: 'studymind_current_user',
  CONVERSATIONS_PREFIX: 'studymind_chats_',
  EXAMS_PREFIX: 'studymind_exams_',
  NOTES_PREFIX: 'studymind_notes_',
  CUSTOM_STORIES_PREFIX: 'studymind_custom_stories_',
  BOOKMARKS_PREFIX: 'studymind_story_bookmarks_',
};

export const DEFAULT_USER: UserProfile = {
  id: 'user_mounika_101',
  email: 'mounika@studymind.ai',
  displayName: 'Mounika Reddy',
  role: 'Student / Scholar',
  isGuest: false,
};

export const Storage = {
  getCurrentUser(): UserProfile {
    try {
      const raw = localStorage.getItem(KEYS.CURRENT_USER);
      if (raw) return JSON.parse(raw) as UserProfile;
    } catch (e) {
      console.warn('Storage read failed:', e);
    }
    this.setCurrentUser(DEFAULT_USER);
    return DEFAULT_USER;
  },

  setCurrentUser(user: UserProfile): void {
    try {
      localStorage.setItem(KEYS.CURRENT_USER, JSON.stringify(user));
    } catch (e) {
      console.warn('Storage write failed:', e);
    }
  },

  getConversations(userId: string): Conversation[] {
    try {
      const raw = localStorage.getItem(`${KEYS.CONVERSATIONS_PREFIX}${userId}`);
      if (raw) {
        const list = JSON.parse(raw) as Conversation[];
        return list.sort(
          (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        );
      }
    } catch (e) {
      console.warn('Failed to load conversations:', e);
    }
    return [];
  },

  saveConversation(userId: string, conv: Conversation): void {
    try {
      const list = this.getConversations(userId);
      const idx = list.findIndex((c) => c.id === conv.id);
      const updated: Conversation = { ...conv, updatedAt: new Date().toISOString() };
      if (idx >= 0) {
        list[idx] = updated;
      } else {
        list.unshift(updated);
      }
      localStorage.setItem(`${KEYS.CONVERSATIONS_PREFIX}${userId}`, JSON.stringify(list));
    } catch (e) {
      console.warn('Failed to save conversation:', e);
    }
  },

  deleteConversation(userId: string, convId: string): void {
    try {
      const list = this.getConversations(userId).filter((c) => c.id !== convId);
      localStorage.setItem(`${KEYS.CONVERSATIONS_PREFIX}${userId}`, JSON.stringify(list));
    } catch (e) {
      console.warn('Failed to delete conversation:', e);
    }
  },

  renameConversation(userId: string, convId: string, newTitle: string): void {
    try {
      const list = this.getConversations(userId);
      const target = list.find((c) => c.id === convId);
      if (target) {
        target.title = newTitle;
        target.updatedAt = new Date().toISOString();
        localStorage.setItem(`${KEYS.CONVERSATIONS_PREFIX}${userId}`, JSON.stringify(list));
      }
    } catch (e) {
      console.warn('Failed to rename conversation:', e);
    }
  },

  getExamAttempts(userId: string): ExamAttempt[] {
    try {
      const raw = localStorage.getItem(`${KEYS.EXAMS_PREFIX}${userId}`);
      if (raw) {
        const list = JSON.parse(raw) as ExamAttempt[];
        return list.sort(
          (a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime()
        );
      }
    } catch (e) {
      console.warn('Failed to read exam attempts:', e);
    }
    return [];
  },

  saveExamAttempt(userId: string, attempt: ExamAttempt): void {
    try {
      const list = this.getExamAttempts(userId);
      list.unshift(attempt);
      localStorage.setItem(`${KEYS.EXAMS_PREFIX}${userId}`, JSON.stringify(list.slice(0, 50)));
    } catch (e) {
      console.warn('Failed to save exam attempt:', e);
    }
  },

  getSavedNotes(userId: string): SavedNote[] {
    try {
      const raw = localStorage.getItem(`${KEYS.NOTES_PREFIX}${userId}`);
      if (raw) {
        const list = JSON.parse(raw) as SavedNote[];
        return list.sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
      }
    } catch (e) {
      console.warn('Failed to read saved notes:', e);
    }
    return [];
  },

  saveNote(userId: string, note: SavedNote): void {
    try {
      const list = this.getSavedNotes(userId);
      list.unshift(note);
      localStorage.setItem(`${KEYS.NOTES_PREFIX}${userId}`, JSON.stringify(list));
    } catch (e) {
      console.warn('Failed to save note:', e);
    }
  },

  deleteNote(userId: string, noteId: string): void {
    try {
      const list = this.getSavedNotes(userId).filter((n) => n.id !== noteId);
      localStorage.setItem(`${KEYS.NOTES_PREFIX}${userId}`, JSON.stringify(list));
    } catch (e) {
      console.warn('Failed to delete note:', e);
    }
  },

  getCustomStories(userId: string): Story[] {
    try {
      const raw = localStorage.getItem(`${KEYS.CUSTOM_STORIES_PREFIX}${userId}`);
      if (raw) return JSON.parse(raw) as Story[];
    } catch (e) {
      console.warn('Failed to load custom stories:', e);
    }
    return [];
  },

  saveCustomStory(userId: string, story: Story): void {
    try {
      const list = this.getCustomStories(userId);
      list.unshift(story);
      localStorage.setItem(`${KEYS.CUSTOM_STORIES_PREFIX}${userId}`, JSON.stringify(list));
    } catch (e) {
      console.warn('Failed to save custom story:', e);
    }
  },

  getBookmarkedStoryIds(userId: string): number[] {
    try {
      const raw = localStorage.getItem(`${KEYS.BOOKMARKS_PREFIX}${userId}`);
      if (raw) return JSON.parse(raw) as number[];
    } catch (e) {
      console.warn('Failed to read bookmarks:', e);
    }
    return [];
  },

  toggleBookmarkStory(userId: string, storyId: number): number[] {
    const ids = this.getBookmarkedStoryIds(userId);
    const next = ids.includes(storyId) ? ids.filter((id) => id !== storyId) : [storyId, ...ids];
    try {
      localStorage.setItem(`${KEYS.BOOKMARKS_PREFIX}${userId}`, JSON.stringify(next));
    } catch (e) {
      console.warn('Failed to save bookmark:', e);
    }
    return next;
  },
};
