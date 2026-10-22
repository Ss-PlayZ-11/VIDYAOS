import React, { useState } from 'react';
import { Bell, CheckCircle2, RotateCcw, Save, X } from 'lucide-react';
import type { IndianBoard, StudentGrade, StudentProfile } from '../types/vidya';
import firebaseConfig from '../../firebase-applet-config.json';
import { GoogleSignInButton } from './GoogleSignInButton';

interface SettingsModalProps {
  profile: StudentProfile;
  googleUserEmail: string | null;
  onClose: () => void;
  onSaveProfile: (updated: StudentProfile) => void;
  onResetAllData: () => void;
  onTestNotification: () => string;
  onGoogleSignIn: () => Promise<void>;
  onGoogleSignOut: () => Promise<void>;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  profile,
  googleUserEmail,
  onClose,
  onSaveProfile,
  onResetAllData,
  onTestNotification,
  onGoogleSignIn,
  onGoogleSignOut,
}) => {
  const [name, setName] = useState<string>(profile.name);
  const [grade, setGrade] = useState<StudentGrade>(profile.grade);
  const [board, setBoard] = useState<IndianBoard>(profile.board);
  const [targetPercentage, setTargetPercentage] = useState<number>(
    profile.targetPercentage
  );
  const [schoolStart, setSchoolStart] = useState<string>(
    profile.schoolSchedule.startTime
  );
  const [schoolEnd, setSchoolEnd] = useState<string>(
    profile.schoolSchedule.endTime
  );
  const [bedTime, setBedTime] = useState<string>(profile.sleepWindow.bedTime);
  const [wakeTime, setWakeTime] = useState<string>(profile.sleepWindow.wakeTime);
  const [customOAuthClientId, setCustomOAuthClientId] = useState<string>(
    profile.customOAuthClientId || firebaseConfig.oAuthClientId || ''
  );
  const [notificationsEnabled, setNotificationsEnabled] = useState<boolean>(
    profile.notificationsEnabled
  );
  const [notifFeedback, setNotifFeedback] = useState<string>('');
  const [confirmReset, setConfirmReset] = useState<boolean>(false);

  const handleRequestNotificationPermission = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      setNotifFeedback('Web Notifications API is not supported in this browser.');
      return;
    }
    const perm = await Notification.requestPermission();
    if (perm === 'granted') {
      setNotificationsEnabled(true);
      setNotifFeedback(
        'Browser notifications enabled. IST background checker active.'
      );
    } else {
      setNotificationsEnabled(false);
      setNotifFeedback(`Notification permission status: ${perm}.`);
    }
  };

  const handleTriggerTestNotification = () => {
    const msg = onTestNotification();
    setNotifFeedback(msg);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSaveProfile({
      ...profile,
      name: name.trim(),
      grade,
      board,
      targetPercentage: Math.min(100, Math.max(50, Number(targetPercentage) || 90)),
      schoolSchedule: {
        ...profile.schoolSchedule,
        startTime: schoolStart,
        endTime: schoolEnd,
      },
      sleepWindow: {
        ...profile.sleepWindow,
        bedTime,
        wakeTime,
      },
      customOAuthClientId: customOAuthClientId.trim(),
      notificationsEnabled,
    });
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-modal-title"
      className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4 overflow-y-auto"
    >
      <div className="bg-white border border-slate-200 rounded-xl max-w-2xl w-full p-6 space-y-6 shadow-xl my-8">
        <div className="flex items-center justify-between pb-4 border-b border-slate-200">
          <div>
            <h2
              id="settings-modal-title"
              className="text-lg font-bold text-slate-900"
            >
              VidyaOS Settings & Integrations
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Edit your Indian School/Tuition IST timings, Web Notifications, and Google Cloud OAuth connection
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Settings"
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Student Profile & Timings */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="settings-name"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Student Name
              </label>
              <input
                id="settings-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label
                htmlFor="settings-target"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Target Exam Percentage (%)
              </label>
              <input
                id="settings-target"
                type="number"
                min={50}
                max={100}
                value={targetPercentage}
                onChange={(e) => setTargetPercentage(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg font-mono tabular-nums"
              />
            </div>
            <div>
              <label
                htmlFor="settings-grade"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Class / Grade
              </label>
              <select
                id="settings-grade"
                value={grade}
                onChange={(e) => setGrade(e.target.value as StudentGrade)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
              >
                <option value="Class 9">Class 9</option>
                <option value="Class 10">Class 10</option>
                <option value="Class 11">Class 11</option>
                <option value="Class 12">Class 12</option>
                <option value="Competitive / Dropper / College">
                  Competitive / Dropper / College
                </option>
              </select>
            </div>
            <div>
              <label
                htmlFor="settings-board"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Board / Exam Track
              </label>
              <select
                id="settings-board"
                value={board}
                onChange={(e) => setBoard(e.target.value as IndianBoard)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
              >
                <option value="CBSE">CBSE</option>
                <option value="ICSE">ICSE</option>
                <option value="State Board">State Board</option>
                <option value="JEE/NEET/CET">JEE/NEET/CET</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label
                htmlFor="settings-school-start"
                className="block text-xs font-medium text-slate-600 mb-1"
              >
                School Start (IST)
              </label>
              <input
                id="settings-school-start"
                type="time"
                value={schoolStart}
                onChange={(e) => setSchoolStart(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded font-mono tabular-nums"
              />
            </div>
            <div>
              <label
                htmlFor="settings-school-end"
                className="block text-xs font-medium text-slate-600 mb-1"
              >
                School End (IST)
              </label>
              <input
                id="settings-school-end"
                type="time"
                value={schoolEnd}
                onChange={(e) => setSchoolEnd(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded font-mono tabular-nums"
              />
            </div>
            <div>
              <label
                htmlFor="settings-bedtime"
                className="block text-xs font-medium text-slate-600 mb-1"
              >
                Bedtime (IST)
              </label>
              <input
                id="settings-bedtime"
                type="time"
                value={bedTime}
                onChange={(e) => setBedTime(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded font-mono tabular-nums"
              />
            </div>
            <div>
              <label
                htmlFor="settings-waketime"
                className="block text-xs font-medium text-slate-600 mb-1"
              >
                Wake Time (IST)
              </label>
              <input
                id="settings-waketime"
                type="time"
                value={wakeTime}
                onChange={(e) => setWakeTime(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded font-mono tabular-nums"
              />
            </div>
          </div>

          {/* Web Notifications Section */}
          <div className="p-4 rounded-lg border border-slate-200 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <Bell className="w-4 h-4 text-indigo-600" />
                  <span>Real IST Web Notifications (School, Tuition & Bedtime Reminders)</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Triggers desktop/mobile alerts 15 mins before School/Tuition and if topics or PDF notes are pending
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleRequestNotificationPermission}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-800 bg-slate-100 border border-slate-300 rounded-lg hover:bg-slate-200 cursor-pointer whitespace-nowrap shrink-0"
                >
                  {notificationsEnabled ? 'Permissions Active' : 'Enable Notifications'}
                </button>
                <button
                  type="button"
                  onClick={handleTriggerTestNotification}
                  className="px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 cursor-pointer whitespace-nowrap shrink-0"
                >
                  Test Notification
                </button>
              </div>
            </div>
            {notifFeedback && (
              <div className="text-xs text-indigo-700 font-medium">
                {notifFeedback}
              </div>
            )}
          </div>

          {/* Google Cloud OAuth & Server AI Connection */}
          <div className="p-4 rounded-lg border border-slate-200 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-xs font-bold text-slate-900">
                  Google Cloud OAuth & AI Service Credentials
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Gemini AI runs securely on the server (`/api/ai/*`). Connect Google below for Drive & Fit APIs.
                </p>
              </div>
              <div>
                {googleUserEmail ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-emerald-700 font-medium flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>{googleUserEmail}</span>
                    </span>
                    <button
                      type="button"
                      onClick={onGoogleSignOut}
                      className="text-xs text-slate-500 hover:text-red-600 underline cursor-pointer"
                    >
                      Sign Out
                    </button>
                  </div>
                ) : (
                  <GoogleSignInButton onClick={onGoogleSignIn} />
                )}
              </div>
            </div>

            <div>
              <label
                htmlFor="oauth-client-id"
                className="block text-xs font-medium text-slate-600 mb-1"
              >
                Google Cloud OAuth Client ID (Provisioned for Drive & Fitness Scopes)
              </label>
              <input
                id="oauth-client-id"
                type="text"
                value={customOAuthClientId}
                onChange={(e) => setCustomOAuthClientId(e.target.value)}
                className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded font-mono text-slate-700 bg-slate-50"
              />
            </div>
          </div>

          {/* Footer Actions */}
          <div className="pt-3 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
            {!confirmReset ? (
              <button
                type="button"
                onClick={() => setConfirmReset(true)}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-red-600 hover:underline cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset Onboarding & Clear Local Storage</span>
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-xs text-red-700 font-semibold">
                  Confirm full reset?
                </span>
                <button
                  type="button"
                  onClick={onResetAllData}
                  className="px-2.5 py-1 text-xs font-semibold text-white bg-red-600 rounded cursor-pointer"
                >
                  Yes, Reset All
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmReset(false)}
                  className="px-2.5 py-1 text-xs text-slate-600 bg-slate-100 rounded cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            )}

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Save Settings</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
