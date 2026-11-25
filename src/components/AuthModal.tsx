import React, { useState } from 'react';
import { Lock, Mail, User, X } from 'lucide-react';
import { UserProfile } from '../types';
import { DEFAULT_USER, Storage } from '../utils/storage';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfile;
  onUpdateUser: (user: UserProfile) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onUpdateUser,
}) => {
  const [mode, setMode] = useState<'profile' | 'login' | 'signup'>('profile');
  const [name, setName] = useState(currentUser.displayName);
  const [email, setEmail] = useState(currentUser.email);
  const [password, setPassword] = useState('');
  const [role, setRole] = useState(currentUser.role || 'Student / Scholar');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);

    if (mode === 'signup' && (!name.trim() || !email.trim() || !password)) {
      setError('Please fill in your name, email, and password.');
      return;
    }
    if (mode === 'login' && (!email.trim() || !password)) {
      setError('Please enter your email and password.');
      return;
    }

    const updated: UserProfile = {
      id: 'user_' + email.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase(),
      email: email.trim(),
      displayName: name.trim() || email.split('@')[0],
      role,
      isGuest: false,
    };
    Storage.setCurrentUser(updated);
    onUpdateUser(updated);
    setNotice('Profile updated successfully.');
    setTimeout(() => {
      setNotice(null);
      onClose();
    }, 800);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-[#0c1829] rounded-2xl max-w-md w-full p-6 border border-sky-100 dark:border-sky-950/80 shadow-xl space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-extrabold text-blue-950 dark:text-white">
              StudyMind Profile
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Your chats, saved notes, and exam history stay organized per profile.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Segmented tabs */}
        <div className="flex items-center bg-slate-100 dark:bg-[#081220] p-1 rounded-xl text-xs font-bold text-slate-500 dark:text-slate-400">
          {(
            [
              { id: 'profile', label: 'Current Profile' },
              { id: 'login', label: 'Switch / Sign In' },
              { id: 'signup', label: 'New Account' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setMode(tab.id);
                setError(null);
                setNotice(null);
              }}
              className={`flex-1 py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                mode === tab.id
                  ? 'bg-white dark:bg-[#0c1829] text-blue-950 dark:text-white shadow-2xs'
                  : 'hover:text-blue-950 dark:hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-xs font-semibold text-rose-700 dark:text-rose-300">
            {error}
          </div>
        )}

        {notice && (
          <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
            {notice}
          </div>
        )}

        {mode === 'profile' ? (
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-[#081220] border border-slate-200/70 dark:border-sky-950 flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-blue-950 dark:bg-sky-600 text-white flex items-center justify-center font-extrabold text-base shrink-0">
                {currentUser.displayName ? currentUser.displayName[0].toUpperCase() : 'U'}
              </div>
              <div className="min-w-0">
                <h4 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                  {currentUser.displayName}
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                  {currentUser.email}
                </p>
                <p className="text-[11px] font-semibold text-sky-700 dark:text-sky-400 mt-0.5">
                  {currentUser.role || 'Scholar'}
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => {
                  Storage.setCurrentUser(DEFAULT_USER);
                  onUpdateUser(DEFAULT_USER);
                  setName(DEFAULT_USER.displayName);
                  setEmail(DEFAULT_USER.email);
                  setRole(DEFAULT_USER.role);
                  setNotice('Switched back to primary profile.');
                }}
                className="w-full py-2.5 rounded-xl border border-sky-200 dark:border-sky-900/60 text-blue-950 dark:text-sky-300 hover:bg-sky-50 dark:hover:bg-sky-950/40 text-xs font-bold transition-colors cursor-pointer"
              >
                Reset to Default Profile (Mounika Reddy)
              </button>

              <button
                type="button"
                onClick={() => {
                  const guest: UserProfile = {
                    id: 'user_guest_' + Date.now(),
                    email: 'guest@studymind.local',
                    displayName: 'Guest Scholar',
                    role: 'Guest Learner',
                    isGuest: true,
                  };
                  Storage.setCurrentUser(guest);
                  onUpdateUser(guest);
                  onClose();
                }}
                className="w-full py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold transition-colors cursor-pointer"
              >
                Switch to Temporary Guest Session
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Your Full Name
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Mounika Reddy"
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-[#081220] rounded-xl border border-slate-200 dark:border-sky-950 text-xs text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-hidden focus:ring-2 focus:ring-sky-400 font-medium"
                  />
                </div>
              </div>
            )}

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-[#081220] rounded-xl border border-slate-200 dark:border-sky-950 text-xs text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-hidden focus:ring-2 focus:ring-sky-400 font-medium"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-[#081220] rounded-xl border border-slate-200 dark:border-sky-950 text-xs text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-hidden focus:ring-2 focus:ring-sky-400 font-medium"
                />
              </div>
            </div>

            {mode === 'signup' && (
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Academic Role
                </label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-[#081220] rounded-xl border border-slate-200 dark:border-sky-950 text-xs text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-sky-400 font-medium"
                >
                  <option value="Student / Scholar">Student / Scholar</option>
                  <option value="Competitive Exam Aspirant">
                    Competitive Exam Aspirant (UPSC/APPSC/TSPSC)
                  </option>
                  <option value="Software Engineer / Learner">
                    Software Engineer / Tech Learner
                  </option>
                  <option value="Educator / Teacher">Educator / Teacher</option>
                </select>
              </div>
            )}

            <button
              type="submit"
              className="w-full py-2.5 rounded-xl bg-blue-950 dark:bg-sky-600 hover:bg-sky-600 dark:hover:bg-sky-500 text-white text-xs font-extrabold shadow-sm transition-colors cursor-pointer"
            >
              {mode === 'signup' ? 'Create Study Account' : 'Sign In to Workspace'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
