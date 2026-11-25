import React, { useState } from 'react';
import {
  ArrowRight,
  Calendar,
  Clock,
  Edit3,
  MessageSquare,
  Plus,
  Search,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { Conversation, UserProfile } from '../types';
import { Storage } from '../utils/storage';

interface HistoryViewProps {
  currentUser: UserProfile;
  onSelectConversation: (id: string) => void;
  onStartNewChat: () => void;
}

export const HistoryView: React.FC<HistoryViewProps> = ({
  currentUser,
  onSelectConversation,
  onStartNewChat,
}) => {
  const [conversations, setConversations] = useState<Conversation[]>(() =>
    Storage.getConversations(currentUser.id)
  );
  const [query, setQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const reload = () => setConversations(Storage.getConversations(currentUser.id));

  const startRename = (conv: Conversation, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(conv.id);
    setEditTitle(conv.title);
  };

  const saveRename = (id: string, e: React.FormEvent) => {
    e.preventDefault();
    if (editTitle.trim()) {
      Storage.renameConversation(currentUser.id, id, editTitle.trim());
      reload();
    }
    setEditingId(null);
  };

  const handleDelete = () => {
    if (!confirmDeleteId) return;
    Storage.deleteConversation(currentUser.id, confirmDeleteId);
    setConfirmDeleteId(null);
    reload();
  };

  const filtered = conversations.filter((c) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      c.title.toLowerCase().includes(q) ||
      c.messages.some((m) => m.content.toLowerCase().includes(q))
    );
  });

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-5">
      {/* Header & Search */}
      <div className="bg-white dark:bg-[#0c1829] rounded-2xl p-5 sm:p-6 border border-sky-100 dark:border-sky-950/80 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-extrabold text-blue-950 dark:text-white tracking-tight">
              Your Study Sessions
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {conversations.length} saved {conversations.length === 1 ? 'conversation' : 'conversations'} for {currentUser.displayName}
            </p>
          </div>
          <button
            type="button"
            onClick={onStartNewChat}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-950 dark:bg-sky-600 hover:bg-sky-600 dark:hover:bg-sky-500 text-white text-xs font-bold transition-colors cursor-pointer self-start sm:self-auto"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Study Chat</span>
          </button>
        </div>

        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search saved conversations by topic or message..."
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-[#081220] rounded-xl border border-slate-200 dark:border-sky-950 text-xs sm:text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-hidden focus:ring-2 focus:ring-sky-400/30 font-medium"
          />
        </div>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="bg-white dark:bg-[#0c1829] rounded-2xl p-10 text-center border border-sky-100 dark:border-sky-950/80 shadow-xs space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-sky-50 dark:bg-[#081220] text-sky-600 dark:text-sky-400 flex items-center justify-center mx-auto">
            <MessageSquare className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              {conversations.length === 0 ? 'No saved study chats yet' : 'No matching conversations'}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {conversations.length === 0
                ? 'Start asking questions in AI Assistant and your learning sessions will appear here automatically.'
                : 'Try searching with another keyword.'}
            </p>
          </div>
          {conversations.length === 0 && (
            <button
              type="button"
              onClick={onStartNewChat}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-950 dark:bg-sky-600 hover:bg-sky-600 dark:hover:bg-sky-500 text-white text-xs font-bold transition-colors cursor-pointer"
            >
              <Sparkles className="w-4 h-4 text-sky-400 dark:text-white" />
              <span>Ask Your First Question</span>
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((conv) => {
            const firstMessage = conv.messages[0]?.content || 'Empty conversation';
            const msgCount = conv.messages.length;
            const dateStr = new Date(conv.updatedAt).toLocaleDateString([], {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            });
            const timeStr = new Date(conv.updatedAt).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            });

            return (
              <div
                key={conv.id}
                onClick={() => onSelectConversation(conv.id)}
                className="group bg-white dark:bg-[#0c1829] hover:bg-sky-50/40 dark:hover:bg-sky-950/30 rounded-2xl p-4 sm:p-5 border border-sky-100/90 dark:border-sky-950/80 hover:border-sky-300 dark:hover:border-sky-800 shadow-2xs transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="flex-1 min-w-0">
                  {editingId === conv.id ? (
                    <form
                      onSubmit={(e) => saveRename(conv.id, e)}
                      onClick={(e) => e.stopPropagation()}
                      className="flex items-center gap-2"
                    >
                      <input
                        type="text"
                        autoFocus
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        className="flex-1 px-3 py-1.5 rounded-lg border border-sky-300 dark:border-sky-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 text-sm font-semibold focus:outline-hidden focus:ring-2 focus:ring-sky-400"
                      />
                      <button
                        type="submit"
                        className="px-3 py-1.5 rounded-lg bg-blue-950 dark:bg-sky-600 text-white text-xs font-bold cursor-pointer"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-bold cursor-pointer"
                      >
                        Cancel
                      </button>
                    </form>
                  ) : (
                    <>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-blue-950 dark:group-hover:text-sky-300 truncate">
                        {conv.title}
                      </h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1 mt-1">
                        {firstMessage}
                      </p>
                    </>
                  )}

                  <div className="flex flex-wrap items-center gap-3 mt-2.5 text-xs text-slate-400 dark:text-slate-500 font-medium tabular-nums">
                    <span className="inline-flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {dateStr}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="inline-flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {timeStr}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="text-sky-700 dark:text-sky-400 font-semibold">
                      {msgCount} {msgCount === 1 ? 'message' : 'messages'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                  <button
                    type="button"
                    onClick={(e) => startRename(conv, e)}
                    title="Rename Conversation"
                    aria-label="Rename Conversation"
                    className="p-2 text-slate-400 hover:text-sky-600 dark:hover:text-sky-400 hover:bg-white dark:hover:bg-slate-800 rounded-xl border border-transparent hover:border-sky-200 dark:hover:border-sky-800 transition-colors cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setConfirmDeleteId(conv.id);
                    }}
                    title="Delete Conversation"
                    aria-label="Delete Conversation"
                    className="p-2 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-white dark:hover:bg-slate-800 rounded-xl border border-transparent hover:border-rose-200 dark:hover:border-rose-900 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                  <div className="w-8 h-8 rounded-xl bg-sky-50 dark:bg-[#081220] text-sky-600 dark:text-sky-400 flex items-center justify-center group-hover:bg-blue-950 group-hover:text-white dark:group-hover:bg-sky-600 transition-colors ml-1">
                    <ArrowRight className="w-4 h-4" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {confirmDeleteId && (
        <div
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50"
          onClick={() => setConfirmDeleteId(null)}
        >
          <div
            className="bg-white dark:bg-[#0c1829] rounded-2xl max-w-sm w-full p-6 shadow-xl border border-sky-100 dark:border-sky-950/80"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-11 h-11 rounded-xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 flex items-center justify-center mb-4">
              <Trash2 className="w-5 h-5" />
            </div>
            <h4 className="text-base font-bold text-slate-900 dark:text-white">
              Delete this conversation?
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 mb-5 leading-relaxed">
              This action cannot be undone. All messages in this chat session will be permanently removed.
            </p>
            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setConfirmDeleteId(null)}
                className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-colors cursor-pointer"
              >
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
