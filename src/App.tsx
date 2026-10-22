/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import {
  ArrowRight,
  Award,
  Bell,
  BookOpen,
  Calendar,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  FileText,
  Sun,
  Watch,
} from 'lucide-react';
import type {
  DailyNoteDocument,
  HealthMetrics,
  HolidayDate,
  QuizSubmission,
  ScheduledStudyTask,
  SchoolTuitionLog,
  StudentProfile,
  SyllabusPlan,
  WeakPointSummary,
} from './types/vidya';
import {
  calculateDailyAvailableStudyHours,
  calculateOverallProjectedScore,
  calculateSubjectProjectedScore,
  computeBioFeedbackCorrelation,
  generateStudySchedule,
  getCurrentISTDateString,
  getCurrentISTHoursAndMinutes,
  getCurrentISTTimeFormatted,
  parseTimeToMinutes,
} from './utils/studyEngine';
import {
  googleSignIn,
  initAuth,
  logoutGoogle,
} from './services/googleIntegration';
import { OnboardingWizard } from './components/OnboardingWizard';
import { SyllabusPlannerView } from './components/SyllabusPlannerView';
import { TopicTrackerQuizView } from './components/TopicTrackerQuizView';
import { SchoolScoreView } from './components/SchoolScoreView';
import { HealthNotesView } from './components/HealthNotesView';
import { SettingsModal } from './components/SettingsModal';

const STORAGE_KEYS = {
  PROFILE: 'vidyaos_profile_v1',
  SYLLABI: 'vidyaos_syllabi_v1',
  HOLIDAYS: 'vidyaos_holidays_v1',
  QUIZ_HISTORY: 'vidyaos_quiz_history_v1',
  WEAK_POINTS: 'vidyaos_weak_points_v1',
  SCHOOL_LOGS: 'vidyaos_school_logs_v1',
  HEALTH_METRICS: 'vidyaos_health_metrics_v1',
  DAILY_NOTES: 'vidyaos_daily_notes_v1',
};

function loadFromStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

type NavTab = 'dashboard' | 'planner' | 'tracker' | 'school' | 'health';

export default function App() {
  const [profile, setProfile] = useState<StudentProfile | null>(() => {
    const saved = loadFromStorage<StudentProfile | null>(
      STORAGE_KEYS.PROFILE,
      null
    );
    if (saved) return saved;

    // Support ?autostart=1 query parameter for instant main-view inspection
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('autostart') === '1') {
        const autoProfile: StudentProfile = {
          name: 'Aarav Sharma',
          grade: 'Class 12',
          board: 'CBSE',
          targetPercentage: 95,
          subjects: ['Mathematics Part 2', 'Physics', 'Chemistry'],
          schoolSchedule: {
            startTime: '07:30',
            endTime: '14:00',
            activeDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
          },
          tuitionBatches: [
            {
              id: 't-auto',
              subject: 'Mathematics Part 2',
              startTime: '16:30',
              endTime: '19:30',
              activeDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
            },
          ],
          sleepWindow: {
            bedTime: '23:00',
            wakeTime: '06:00',
            preferredStudySlot: 'Balanced Split (Morning + Evening)',
          },
          notificationsEnabled: false,
          onboardedAt: new Date().toISOString(),
        };
        localStorage.setItem(STORAGE_KEYS.PROFILE, JSON.stringify(autoProfile));
        return autoProfile;
      }
    }
    return null;
  });

  const [syllabi, setSyllabi] = useState<SyllabusPlan[]>(() =>
    loadFromStorage<SyllabusPlan[]>(STORAGE_KEYS.SYLLABI, [])
  );
  const [holidays, setHolidays] = useState<HolidayDate[]>(() =>
    loadFromStorage<HolidayDate[]>(STORAGE_KEYS.HOLIDAYS, [])
  );
  const [quizHistory, setQuizHistory] = useState<QuizSubmission[]>(() =>
    loadFromStorage<QuizSubmission[]>(STORAGE_KEYS.QUIZ_HISTORY, [])
  );
  const [weakPointSummaries, setWeakPointSummaries] = useState<
    WeakPointSummary[]
  >(() => loadFromStorage<WeakPointSummary[]>(STORAGE_KEYS.WEAK_POINTS, []));
  const [schoolTuitionLogs, setSchoolTuitionLogs] = useState<
    SchoolTuitionLog[]
  >(() => loadFromStorage<SchoolTuitionLog[]>(STORAGE_KEYS.SCHOOL_LOGS, []));
  const [healthMetricsList, setHealthMetricsList] = useState<HealthMetrics[]>(
    () => loadFromStorage<HealthMetrics[]>(STORAGE_KEYS.HEALTH_METRICS, [])
  );
  const [dailyNotes, setDailyNotes] = useState<DailyNoteDocument[]>(() =>
    loadFromStorage<DailyNoteDocument[]>(STORAGE_KEYS.DAILY_NOTES, [])
  );

  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [activeQuizTask, setActiveQuizTask] =
    useState<ScheduledStudyTask | null>(null);
  const [inAppBannerAlert, setInAppBannerAlert] = useState<string>('');
  const [googleUserEmail, setGoogleUserEmail] = useState<string | null>(null);

  const [currentDateStr, setCurrentDateStr] = useState<string>(() =>
    getCurrentISTDateString()
  );
  const [currentISTClock, setCurrentISTClock] = useState<string>(() =>
    getCurrentISTTimeFormatted()
  );

  // Persist state slices to localStorage
  useEffect(() => {
    if (profile) {
      localStorage.setItem(STORAGE_KEYS.PROFILE, JSON.stringify(profile));
    }
  }, [profile]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.SYLLABI, JSON.stringify(syllabi));
  }, [syllabi]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.HOLIDAYS, JSON.stringify(holidays));
  }, [holidays]);

  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEYS.QUIZ_HISTORY,
      JSON.stringify(quizHistory)
    );
  }, [quizHistory]);

  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEYS.WEAK_POINTS,
      JSON.stringify(weakPointSummaries)
    );
  }, [weakPointSummaries]);

  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEYS.SCHOOL_LOGS,
      JSON.stringify(schoolTuitionLogs)
    );
  }, [schoolTuitionLogs]);

  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEYS.HEALTH_METRICS,
      JSON.stringify(healthMetricsList)
    );
  }, [healthMetricsList]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.DAILY_NOTES, JSON.stringify(dailyNotes));
  }, [dailyNotes]);

  // Initialize Firebase Google Auth listener
  useEffect(() => {
    const unsubscribe = initAuth(
      (user) => {
        setGoogleUserEmail(user.email || user.displayName || 'Connected User');
      },
      () => {
        setGoogleUserEmail(null);
      }
    );
    return () => unsubscribe();
  }, []);

  // Keep refs for background IST notification checker
  const stateRef = useRef({
    profile,
    syllabi,
    dailyNotes,
    currentDateStr,
  });
  useEffect(() => {
    stateRef.current = { profile, syllabi, dailyNotes, currentDateStr };
  }, [profile, syllabi, dailyNotes, currentDateStr]);

  const sendBrowserNotification = (title: string, body: string) => {
    setInAppBannerAlert(`${title}: ${body}`);
    if (
      typeof window !== 'undefined' &&
      'Notification' in window &&
      Notification.permission === 'granted'
    ) {
      try {
        new Notification(title, { body });
      } catch (e) {
        console.error('Notification error:', e);
      }
    }
  };

  // Active 60-second IST clock & Notification Background Timer
  useEffect(() => {
    const checkISTSchedule = () => {
      const now = new Date();
      setCurrentDateStr(getCurrentISTDateString(now));
      setCurrentISTClock(getCurrentISTTimeFormatted(now));

      const { profile: prof, syllabi: syl, dailyNotes: notes, currentDateStr: dStr } =
        stateRef.current;
      if (!prof) return;

      const { hours, minutes, dayOfWeek } = getCurrentISTHoursAndMinutes(now);
      const nowTotalMins = hours * 60 + minutes;

      // 1. Check if School starts in 15 minutes
      if (prof.schoolSchedule.activeDays.includes(dayOfWeek)) {
        const schoolStartMins = parseTimeToMinutes(
          prof.schoolSchedule.startTime
        );
        if (schoolStartMins - nowTotalMins === 15) {
          sendBrowserNotification(
            'VidyaOS School Reminder (IST)',
            `Your School session starts in 15 minutes (${prof.schoolSchedule.startTime} IST).`
          );
        }
      }

      // 2. Check if any Tuition batch starts in 15 minutes
      for (const batch of prof.tuitionBatches) {
        if (batch.activeDays.includes(dayOfWeek)) {
          const batchStartMins = parseTimeToMinutes(batch.startTime);
          if (batchStartMins - nowTotalMins === 15) {
            sendBrowserNotification(
              'VidyaOS Tuition Reminder (IST)',
              `${batch.subject} Tuition starts in 15 minutes (${batch.startTime} IST).`
            );
          }
        }
      }

      // 3. Evening incomplete study topic check (at 20:00 IST)
      const allTopics = syl.flatMap((s) =>
        s.chapters.flatMap((c) => c.subTopics)
      );
      const pendingToday = allTopics.filter((t) => !t.completed);
      if (hours === 20 && minutes === 0 && pendingToday.length > 0) {
        sendBrowserNotification(
          'VidyaOS Evening Study Check',
          `You have ${pendingToday.length} pending study sub-topic(s) in your queue tonight.`
        );
      }

      // 4. Bedtime PDF revision notes reminder (30 mins before bedtime)
      const bedMins = parseTimeToMinutes(prof.sleepWindow.bedTime);
      const hasNoteToday = notes.some((n) => n.date === dStr);
      if (bedMins - nowTotalMins === 30 && !hasNoteToday) {
        sendBrowserNotification(
          'VidyaOS Bedtime Revision PDF Pending',
          'Generate your Daily Short Revision PDF & sync to Google Drive before bedtime.'
        );
      }
    };

    const interval = setInterval(checkISTSchedule, 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const handleTestNotification = (): string => {
    const title = 'VidyaOS Live IST Notification Verified';
    const body = `Active for ${profile?.name || 'Student'} (${currentISTClock}). School, Tuition & Study reminders are armed.`;
    sendBrowserNotification(title, body);
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'granted') {
        return 'Sent live browser notification and verified IST background timer.';
      }
      return 'Displayed in-app notification banner (click "Enable Notifications" to grant OS popup permission).';
    }
    return 'Displayed in-app notification banner.';
  };

  const handleGoogleSignIn = async () => {
    try {
      const res = await googleSignIn();
      if (res?.user) {
        setGoogleUserEmail(
          res.user.email || res.user.displayName || 'Connected User'
        );
      }
    } catch (error: any) {
      setInAppBannerAlert(
        error?.message || 'Google Sign-In popup was closed or blocked.'
      );
    }
  };

  const handleGoogleSignOut = async () => {
    await logoutGoogle();
    setGoogleUserEmail(null);
  };

  // If no profile exists in localStorage, render the One-Time Onboarding Wizard
  if (!profile) {
    return (
      <OnboardingWizard
        onComplete={(newProfile) => {
          setProfile(newProfile);
          localStorage.setItem(
            STORAGE_KEYS.PROFILE,
            JSON.stringify(newProfile)
          );
        }}
      />
    );
  }

  // Compute dynamic study schedule from syllabi, profile, and holidays
  const { dailyTasks, weeklyTargets, monthlyMilestones } =
    generateStudySchedule(syllabi, profile, holidays, currentDateStr);

  const todayCapacity = calculateDailyAvailableStudyHours(
    profile,
    currentDateStr,
    holidays
  );
  const isTodayHoliday = holidays.some((h) => h.date === currentDateStr);

  const subjectScores = profile.subjects.map((subj) =>
    calculateSubjectProjectedScore(
      subj,
      profile,
      syllabi,
      quizHistory,
      schoolTuitionLogs,
      currentDateStr
    )
  );
  const overallProjectedScore = calculateOverallProjectedScore(subjectScores);

  const latestHealth =
    healthMetricsList.find((h) => h.date === currentDateStr) ||
    healthMetricsList[0] ||
    null;
  const bioFeedback = computeBioFeedbackCorrelation(latestHealth);

  // Handlers
  const handleAddSyllabus = (plan: SyllabusPlan) => {
    setSyllabi((prev) => [...prev, plan]);
  };

  const handleDeleteSyllabus = (id: string) => {
    setSyllabi((prev) => prev.filter((p) => p.id !== id));
  };

  const handleToggleHoliday = (holiday: HolidayDate) => {
    setHolidays((prev) => {
      const filtered = prev.filter((h) => h.date !== holiday.date);
      return [...filtered, holiday].sort((a, b) =>
        a.date.localeCompare(b.date)
      );
    });
  };

  const handleRemoveHoliday = (dateStr: string) => {
    setHolidays((prev) => prev.filter((h) => h.date !== dateStr));
  };

  const handleCompleteTopicAndTriggerQuiz = (task: ScheduledStudyTask) => {
    // Mark topic completed in syllabi state
    setSyllabi((prev) =>
      prev.map((plan) => ({
        ...plan,
        chapters: plan.chapters.map((ch) => ({
          ...ch,
          subTopics: ch.subTopics.map((st) =>
            st.id === task.subTopicId
              ? {
                  ...st,
                  completed: true,
                  completedAt: currentDateStr,
                  scheduledDate: task.scheduledDate,
                }
              : st
          ),
        })),
      }))
    );
    setActiveQuizTask(task);
    setActiveTab('tracker');
  };

  const handleSaveQuizResult = (
    submission: QuizSubmission,
    weakPoint: WeakPointSummary
  ) => {
    setQuizHistory((prev) => [submission, ...prev]);
    setWeakPointSummaries((prev) => [weakPoint, ...prev]);
    setSyllabi((prev) =>
      prev.map((plan) => ({
        ...plan,
        chapters: plan.chapters.map((ch) => ({
          ...ch,
          subTopics: ch.subTopics.map((st) =>
            st.id === submission.subTopicId
              ? {
                  ...st,
                  completed: true,
                  quizScorePercent: submission.accuracyPercent,
                }
              : st
          ),
        })),
      }))
    );
  };

  const handleAddSchoolTuitionLog = (log: SchoolTuitionLog) => {
    setSchoolTuitionLogs((prev) => [log, ...prev]);
  };

  const handleToggleLogRevision = (logId: string) => {
    setSchoolTuitionLogs((prev) =>
      prev.map((l) =>
        l.id === logId ? { ...l, revisionCompleted: !l.revisionCompleted } : l
      )
    );
  };

  const handleDeleteLog = (logId: string) => {
    setSchoolTuitionLogs((prev) => prev.filter((l) => l.id !== logId));
  };

  const handleSaveDailyNote = (note: DailyNoteDocument) => {
    setDailyNotes((prev) => {
      const filtered = prev.filter((n) => n.id !== note.id);
      return [note, ...filtered];
    });
  };

  const handleSaveHealthMetrics = (metrics: HealthMetrics) => {
    setHealthMetricsList((prev) => {
      const filtered = prev.filter((m) => m.date !== metrics.date);
      return [metrics, ...filtered];
    });
  };

  const handleResetAllData = () => {
    Object.values(STORAGE_KEYS).forEach((k) => localStorage.removeItem(k));
    setProfile(null);
    setSyllabi([]);
    setHolidays([]);
    setQuizHistory([]);
    setWeakPointSummaries([]);
    setSchoolTuitionLogs([]);
    setHealthMetricsList([]);
    setDailyNotes([]);
    setIsSettingsOpen(false);
  };

  const completedTasksCount = dailyTasks.filter((t) => t.completed).length;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      {/* Strict 3-Zone Top Bar Contract */}
      <header className="sticky top-0 z-30 bg-white border-b border-slate-200 px-6 py-3.5">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-8">
          {/* Zone 1: Single text element wordmark */}
          <a
            href="#top"
            onClick={(e) => {
              e.preventDefault();
              setActiveTab('dashboard');
            }}
            className="text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0"
          >
            VidyaOS
          </a>

          {/* Zone 2: 5 clean single-line text navigation links */}
          <nav
            aria-label="Main Navigation"
            className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-600"
          >
            <button
              type="button"
              onClick={() => setActiveTab('dashboard')}
              className={`py-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === 'dashboard'
                  ? 'text-indigo-600 font-semibold underline underline-offset-8 decoration-2'
                  : 'hover:text-slate-900'
              }`}
            >
              Dashboard
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('planner')}
              className={`py-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === 'planner'
                  ? 'text-indigo-600 font-semibold underline underline-offset-8 decoration-2'
                  : 'hover:text-slate-900'
              }`}
            >
              Planner
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('tracker')}
              className={`py-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === 'tracker'
                  ? 'text-indigo-600 font-semibold underline underline-offset-8 decoration-2'
                  : 'hover:text-slate-900'
              }`}
            >
              Tracker & Quiz
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('school')}
              className={`py-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === 'school'
                  ? 'text-indigo-600 font-semibold underline underline-offset-8 decoration-2'
                  : 'hover:text-slate-900'
              }`}
            >
              School & Score
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('health')}
              className={`py-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === 'health'
                  ? 'text-indigo-600 font-semibold underline underline-offset-8 decoration-2'
                  : 'hover:text-slate-900'
              }`}
            >
              Health & Notes
            </button>
          </nav>

          {/* Zone 3: 1 primary action */}
          <div className="flex items-center shrink-0">
            <button
              type="button"
              onClick={() => setIsSettingsOpen(true)}
              className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              Settings
            </button>
          </div>
        </div>
      </header>

      {/* Main Workspace Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6 sm:space-y-8">
        {/* Responsive Mobile Navigation Strip (< md) */}
        <nav
          aria-label="Mobile Workspace Navigation"
          className="md:hidden grid grid-cols-5 gap-1 p-1 bg-slate-200/70 rounded-lg text-center"
        >
          <button
            type="button"
            onClick={() => setActiveTab('dashboard')}
            className={`py-1.5 px-1 text-[11px] font-semibold rounded-md transition-colors whitespace-nowrap truncate ${
              activeTab === 'dashboard'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600'
            }`}
          >
            Home
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('planner')}
            className={`py-1.5 px-1 text-[11px] font-semibold rounded-md transition-colors whitespace-nowrap truncate ${
              activeTab === 'planner'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600'
            }`}
          >
            Planner
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('tracker')}
            className={`py-1.5 px-1 text-[11px] font-semibold rounded-md transition-colors whitespace-nowrap truncate ${
              activeTab === 'tracker'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600'
            }`}
          >
            Quiz
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('school')}
            className={`py-1.5 px-1 text-[11px] font-semibold rounded-md transition-colors whitespace-nowrap truncate ${
              activeTab === 'school'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600'
            }`}
          >
            Score
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('health')}
            className={`py-1.5 px-1 text-[11px] font-semibold rounded-md transition-colors whitespace-nowrap truncate ${
              activeTab === 'health'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600'
            }`}
          >
            Health
          </button>
        </nav>
        {/* Live Notification Banner if triggered */}
        {inAppBannerAlert && (
          <div
            role="status"
            className="p-3.5 rounded-xl bg-indigo-950 text-white flex items-center justify-between gap-4"
          >
            <div className="flex items-center gap-2.5 text-xs">
              <Bell className="w-4 h-4 text-indigo-300 shrink-0" />
              <span>{inAppBannerAlert}</span>
            </div>
            <button
              type="button"
              onClick={() => setInAppBannerAlert('')}
              className="text-xs text-indigo-200 hover:text-white underline shrink-0 cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Contextual Student Header Strip */}
        <section className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-1.5">
            <div className="text-xs text-slate-500 font-mono tabular-nums">
              <span>{currentDateStr}</span>
              <span aria-hidden="true" className="mx-2">·</span>
              <span>{currentISTClock}</span>
              <span aria-hidden="true" className="mx-2">·</span>
              <span>{profile.grade}</span>
              <span aria-hidden="true" className="mx-2">·</span>
              <span>{profile.board}</span>
              <span aria-hidden="true" className="mx-2">·</span>
              <span>Target: {profile.targetPercentage}%</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
              Namaste, {profile.name}
            </h1>
            <p className="text-xs text-slate-600">
              Subjects: {profile.subjects.join(' · ')}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => {
                if (isTodayHoliday) {
                  handleRemoveHoliday(currentDateStr);
                } else {
                  handleToggleHoliday({
                    date: currentDateStr,
                    label: 'No-School / Festival Holiday',
                    noSchool: true,
                    noTuition: false,
                  });
                }
              }}
              className={`inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                isTodayHoliday
                  ? 'bg-amber-600 text-white border-amber-600 hover:bg-amber-700'
                  : 'bg-white text-slate-800 border-slate-300 hover:bg-slate-100'
              }`}
            >
              <Sun className="w-4 h-4" />
              <span>
                {isTodayHoliday
                  ? `Holiday Active (${todayCapacity.availableHours}h Free)`
                  : 'Mark Today as Holiday / No-School'}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('planner')}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <BookOpen className="w-4 h-4" />
              <span>Add Syllabus / Rebalance Plan</span>
            </button>
          </div>
        </section>

        {/* Active View Content */}
        {activeTab === 'dashboard' && (
          <motion.div
            key="dashboard"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.16 }}
            className="space-y-8"
          >
            {/* 4 Key KPI Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-1.5">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>Net Self-Study Capacity Today</span>
                  <Clock className="w-4 h-4 text-indigo-600" />
                </div>
                <div className="text-2xl font-bold font-mono tabular-nums text-slate-900">
                  {todayCapacity.availableHours} hrs
                </div>
                <div className="text-xs text-slate-500 font-mono tabular-nums">
                  School: {todayCapacity.schoolHours}h · Tuition: {todayCapacity.tuitionHours}h
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-1.5">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>Syllabus Topics Completed</span>
                  <ClipboardCheck className="w-4 h-4 text-emerald-600" />
                </div>
                <div className="text-2xl font-bold font-mono tabular-nums text-slate-900">
                  {completedTasksCount} / {dailyTasks.length}
                </div>
                <div className="text-xs text-slate-500">
                  {syllabi.length === 0
                    ? 'Upload syllabus in Planner to start'
                    : `${quizHistory.length} verification quiz(zes) taken`}
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-1.5">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>Projected Exam Score (Grader)</span>
                  <Award className="w-4 h-4 text-indigo-600" />
                </div>
                <div className="text-2xl font-bold font-mono tabular-nums text-indigo-600">
                  {overallProjectedScore > 0
                    ? `${overallProjectedScore} / 100`
                    : '— / 100'}
                </div>
                <div className="text-xs text-slate-500 font-mono tabular-nums">
                  Target Goal: {profile.targetPercentage} / 100
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-1.5">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>boAt / Google Fit Bio-Readiness</span>
                  <Watch className="w-4 h-4 text-indigo-600" />
                </div>
                <div className="text-lg font-bold font-mono tabular-nums text-slate-900">
                  {latestHealth
                    ? `${latestHealth.sleepHours}h Sleep · ${latestHealth.steps.toLocaleString('en-IN')} Steps`
                    : 'Not Synced Yet'}
                </div>
                <div className="text-xs text-slate-500">
                  Recommended Block: {bioFeedback.recommendedBlockMinutes} min
                </div>
              </div>
            </div>

            {/* Two-Column Split: Today's Study Queue + School/Notes Quick Actions */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
              {/* Left 7 Cols: Today's Actionable Study Checklist */}
              <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6 flex flex-col justify-between space-y-5">
                <div className="space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                    <div>
                      <h2 className="text-base font-bold text-slate-900">
                        Today&apos;s Scheduled Study Queue ({currentDateStr})
                      </h2>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Tick any topic as Done to trigger an instant 5-question {profile.board} verification quiz
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveTab('tracker')}
                      className="text-xs font-semibold text-indigo-600 hover:underline cursor-pointer whitespace-nowrap shrink-0"
                    >
                      Open Full Tracker
                    </button>
                  </div>

                  {dailyTasks.length === 0 ? (
                    <div className="py-10 text-center space-y-3">
                      <Calendar className="w-8 h-8 text-slate-400 mx-auto" />
                      <div className="text-sm font-semibold text-slate-900">
                        Your Study Queue is Clean & Ready
                      </div>
                      <p className="text-xs text-slate-500 max-w-md mx-auto">
                        Zero pre-populated fake data. Click below to parse your textbook syllabus (e.g., NCERT Class 12 Maths or Physics) with Gemini and generate your personalized daily plan.
                      </p>
                      <button
                        type="button"
                        onClick={() => setActiveTab('planner')}
                        className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 cursor-pointer"
                      >
                        <span>Parse My First Syllabus</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-200">
                      {dailyTasks.slice(0, 5).map((task) => (
                        <div
                          key={task.subTopicId}
                          className="py-3 flex items-center justify-between gap-3"
                        >
                          <div className="flex items-start gap-3">
                            <button
                              type="button"
                              onClick={() =>
                                handleCompleteTopicAndTriggerQuiz(task)
                              }
                              aria-label={`Complete ${task.subTopicTitle} and start quiz`}
                              className={`mt-0.5 w-5 h-5 rounded border flex items-center justify-center transition-colors cursor-pointer shrink-0 ${
                                task.completed
                                  ? 'bg-emerald-600 border-emerald-600 text-white'
                                  : 'bg-white border-slate-300 hover:border-indigo-600'
                              }`}
                            >
                              {task.completed && (
                                <CheckCircle2 className="w-3.5 h-3.5" />
                              )}
                            </button>
                            <div>
                              <div
                                className={`text-sm font-semibold ${
                                  task.completed
                                    ? 'line-through text-slate-400'
                                    : 'text-slate-900'
                                }`}
                              >
                                {task.subTopicTitle}
                              </div>
                              <div className="text-xs text-slate-500">
                                <span>{task.subject}</span>
                                <span aria-hidden="true" className="mx-1.5">·</span>
                                <span>{task.chapterTitle}</span>
                                <span aria-hidden="true" className="mx-1.5">·</span>
                                <span className="font-mono tabular-nums">
                                  {task.estimatedMinutes} min
                                </span>
                                <span aria-hidden="true" className="mx-1.5">·</span>
                                <span className="font-mono tabular-nums">
                                  {task.scheduledDate}
                                </span>
                              </div>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() =>
                              handleCompleteTopicAndTriggerQuiz(task)
                            }
                            className="px-3 py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 cursor-pointer whitespace-nowrap shrink-0"
                          >
                            {task.completed ? 'Retake Quiz' : 'Done + Quiz'}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {weeklyTargets.length > 0 && (
                  <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-700">
                    <strong className="text-slate-900">Active Weekly Target:</strong>{' '}
                    {weeklyTargets[0].summaryText}
                  </div>
                )}
              </div>

              {/* Right 5 Cols: Daily Schedule & Quick Module Navigation */}
              <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6 flex flex-col justify-between space-y-5">
                <div className="space-y-4">
                  <h2 className="text-base font-bold text-slate-900 pb-3 border-b border-slate-200">
                    Your Calibrated IST Daily Rhythm
                  </h2>

                  <div className="space-y-2.5 text-xs">
                    <div className="flex items-center justify-between py-1.5 border-b border-slate-100">
                      <span className="text-slate-600">School / College Window</span>
                      <span className="font-mono tabular-nums font-semibold text-slate-900">
                        {isTodayHoliday
                          ? 'Holiday (Off Today)'
                          : `${profile.schoolSchedule.startTime} – ${profile.schoolSchedule.endTime} IST`}
                      </span>
                    </div>

                    <div className="flex items-center justify-between py-1.5 border-b border-slate-100">
                      <span className="text-slate-600">Tuition / Coaching Batches</span>
                      <span className="font-mono tabular-nums font-semibold text-slate-900">
                        {profile.tuitionBatches.length === 0
                          ? 'None Scheduled'
                          : `${profile.tuitionBatches.length} Active Batch(es)`}
                      </span>
                    </div>

                    <div className="flex items-center justify-between py-1.5 border-b border-slate-100">
                      <span className="text-slate-600">Preferred Self-Study Slot</span>
                      <span className="font-semibold text-slate-900">
                        {profile.sleepWindow.preferredStudySlot}
                      </span>
                    </div>

                    <div className="flex items-center justify-between py-1.5">
                      <span className="text-slate-600">Restorative Sleep Window</span>
                      <span className="font-mono tabular-nums font-semibold text-slate-900">
                        {profile.sleepWindow.bedTime} – {profile.sleepWindow.wakeTime} IST
                      </span>
                    </div>
                  </div>
                </div>

                <div className="space-y-2.5 pt-3 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={() => setActiveTab('school')}
                    className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-semibold text-slate-800 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 cursor-pointer"
                  >
                    <span>Log Today&apos;s School & Tuition Topics (90/100 Grader)</span>
                    <ArrowRight className="w-4 h-4 text-slate-500" />
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab('health')}
                    className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-semibold text-slate-800 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 cursor-pointer"
                  >
                    <span className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-indigo-600" />
                      <span>Generate Daily Revision PDF & Sync Google Drive / Fit</span>
                    </span>
                    <ArrowRight className="w-4 h-4 text-slate-500" />
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'planner' && (
          <SyllabusPlannerView
            profile={profile}
            currentDateStr={currentDateStr}
            syllabi={syllabi}
            holidays={holidays}
            dailyTasks={dailyTasks}
            weeklyTargets={weeklyTargets}
            monthlyMilestones={monthlyMilestones}
            onAddSyllabus={handleAddSyllabus}
            onDeleteSyllabus={handleDeleteSyllabus}
            onToggleHoliday={handleToggleHoliday}
            onRemoveHoliday={handleRemoveHoliday}
            onToggleTaskCompletion={(subTopicId) => {
              const found = dailyTasks.find((t) => t.subTopicId === subTopicId);
              if (found) {
                handleCompleteTopicAndTriggerQuiz(found);
              }
            }}
          />
        )}

        {activeTab === 'tracker' && (
          <TopicTrackerQuizView
            profile={profile}
            currentDateStr={currentDateStr}
            dailyTasks={dailyTasks}
            quizHistory={quizHistory}
            weakPointSummaries={weakPointSummaries}
            onCompleteTopicAndTriggerQuiz={handleCompleteTopicAndTriggerQuiz}
            onSaveQuizResult={handleSaveQuizResult}
            activeQuizTask={activeQuizTask}
            onClearActiveQuizTask={() => setActiveQuizTask(null)}
          />
        )}

        {activeTab === 'school' && (
          <SchoolScoreView
            profile={profile}
            currentDateStr={currentDateStr}
            syllabi={syllabi}
            quizHistory={quizHistory}
            schoolTuitionLogs={schoolTuitionLogs}
            latestHealth={latestHealth}
            onAddSchoolTuitionLog={handleAddSchoolTuitionLog}
            onToggleLogRevision={handleToggleLogRevision}
            onDeleteLog={handleDeleteLog}
          />
        )}

        {activeTab === 'health' && (
          <HealthNotesView
            profile={profile}
            currentDateStr={currentDateStr}
            completedTasks={dailyTasks.filter((t) => t.completed)}
            weakPointSummaries={weakPointSummaries}
            schoolTuitionLogs={schoolTuitionLogs}
            dailyNotes={dailyNotes}
            latestHealth={latestHealth}
            googleUserEmail={googleUserEmail}
            onGoogleSignIn={handleGoogleSignIn}
            onSaveDailyNote={handleSaveDailyNote}
            onSaveHealthMetrics={handleSaveHealthMetrics}
          />
        )}
      </main>

      {/* Quiet Footer */}
      <footer className="border-t border-slate-200 bg-white px-6 py-4 mt-12">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500">
          <span>
            VidyaOS — Indian Student AI Study, Performance & Health Companion
          </span>
          <span className="font-mono tabular-nums">
            Timezone: Asia/Kolkata (IST) · Persistent Local Storage Active
          </span>
        </div>
      </footer>

      {isSettingsOpen && (
        <SettingsModal
          profile={profile}
          googleUserEmail={googleUserEmail}
          onClose={() => setIsSettingsOpen(false)}
          onSaveProfile={(updated) => setProfile(updated)}
          onResetAllData={handleResetAllData}
          onTestNotification={handleTestNotification}
          onGoogleSignIn={handleGoogleSignIn}
          onGoogleSignOut={handleGoogleSignOut}
        />
      )}
    </div>
  );
}
