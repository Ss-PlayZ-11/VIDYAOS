import type {
  DayOfWeek,
  HealthMetrics,
  HolidayDate,
  MonthlyMilestone,
  QuizQuestion,
  QuizSubmission,
  ScheduledStudyTask,
  SchoolTuitionLog,
  StudentProfile,
  SyllabusPlan,
  WeeklyMilestone,
} from '../types/vidya';

const DAY_NAMES: DayOfWeek[] = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/**
 * Returns YYYY-MM-DD in Asia/Kolkata (IST) timezone.
 */
export function getCurrentISTDateString(now: Date = new Date()): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(now);
}

/**
 * Returns formatted IST time (e.g., "09:45 PM IST")
 */
export function getCurrentISTTimeFormatted(now: Date = new Date()): string {
  const formatter = new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
  return `${formatter.format(now).toUpperCase()} IST`;
}

/**
 * Returns numeric hour and minute in IST for background notification checks.
 */
export function getCurrentISTHoursAndMinutes(now: Date = new Date()): {
  hours: number;
  minutes: number;
  dayOfWeek: DayOfWeek;
} {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    hour: 'numeric',
    minute: 'numeric',
    weekday: 'short',
    hour12: false,
  }).formatToParts(now);

  let hours = 0;
  let minutes = 0;
  let weekday = 'Mon';
  for (const p of parts) {
    if (p.type === 'hour') hours = Number(p.value) % 24;
    if (p.type === 'minute') minutes = Number(p.value);
    if (p.type === 'weekday') weekday = p.value;
  }
  const matchedDay = DAY_NAMES.find((d) => weekday.startsWith(d)) || 'Mon';
  return { hours, minutes, dayOfWeek: matchedDay };
}

/**
 * Parses "HH:MM" into total minutes from midnight.
 */
export function parseTimeToMinutes(hhmm: string): number {
  const [hStr, mStr] = (hhmm || '00:00').split(':');
  const h = Number(hStr);
  const m = Number(mStr);
  if (Number.isNaN(h) || Number.isNaN(m)) return 0;
  return h * 60 + m;
}

/**
 * Computes duration in hours between start "HH:MM" and end "HH:MM" (handles overnight wrap).
 */
export function computeSlotDurationHours(startTime: string, endTime: string): number {
  const startMin = parseTimeToMinutes(startTime);
  const endMin = parseTimeToMinutes(endTime);
  let diff = endMin - startMin;
  if (diff <= 0) {
    diff += 24 * 60;
  }
  return Math.round((diff / 60) * 10) / 10;
}

/**
 * Returns the DayOfWeek ('Mon'..'Sun') for a YYYY-MM-DD date string.
 */
export function getDayOfWeekFromDateString(dateStr: string): DayOfWeek {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, (m || 1) - 1, d || 1, 12, 0, 0));
  return DAY_NAMES[dt.getUTCDay()];
}

/**
 * Adds N days to a YYYY-MM-DD string and returns new YYYY-MM-DD string.
 */
export function addDaysToDateString(dateStr: string, daysToAdd: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, (m || 1) - 1, (d || 1) + daysToAdd, 12, 0, 0));
  const year = dt.getUTCFullYear();
  const month = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const day = String(dt.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Calculates net available self-study hours on a given date (accounting for School, Tuition, Sleep, and Holiday overrides).
 */
export function calculateDailyAvailableStudyHours(
  profile: StudentProfile,
  dateStr: string,
  holidays: HolidayDate[]
): {
  availableHours: number;
  schoolHours: number;
  tuitionHours: number;
  sleepHours: number;
  isHoliday: boolean;
  holidayLabel?: string;
} {
  const dayOfWeek = getDayOfWeekFromDateString(dateStr);
  const holiday = holidays.find((h) => h.date === dateStr);

  const sleepHours = computeSlotDurationHours(
    profile.sleepWindow.bedTime,
    profile.sleepWindow.wakeTime
  );

  const isSchoolActiveDay = profile.schoolSchedule.activeDays.includes(dayOfWeek);
  const schoolHours =
    isSchoolActiveDay && !(holiday && holiday.noSchool)
      ? computeSlotDurationHours(profile.schoolSchedule.startTime, profile.schoolSchedule.endTime)
      : 0;

  let tuitionHours = 0;
  if (!(holiday && holiday.noTuition)) {
    for (const batch of profile.tuitionBatches) {
      if (batch.activeDays.includes(dayOfWeek)) {
        tuitionHours += computeSlotDurationHours(batch.startTime, batch.endTime);
      }
    }
  }

  // Account for 3.5 hours of meals, commute, bathing, and rest buffer
  const routineBufferHours = 3.5;
  const rawFreeHours = 24 - sleepHours - schoolHours - tuitionHours - routineBufferHours;

  // Realistic focused self-study cap: up to 9.5 hrs on full holidays, minimum 1.5 hrs on packed days
  const availableHours = Math.max(1.5, Math.min(9.5, Math.round(rawFreeHours * 2) / 2));

  return {
    availableHours,
    schoolHours: Math.round(schoolHours * 10) / 10,
    tuitionHours: Math.round(tuitionHours * 10) / 10,
    sleepHours: Math.round(sleepHours * 10) / 10,
    isHoliday: Boolean(holiday),
    holidayLabel: holiday?.label,
  };
}

/**
 * Dynamically distributes syllabus sub-topics across dates starting from startDateStr,
 * rebalancing automatically when holidays/no-school days are toggled.
 */
export function generateStudySchedule(
  syllabi: SyllabusPlan[],
  profile: StudentProfile,
  holidays: HolidayDate[],
  startDateStr: string
): {
  dailyTasks: ScheduledStudyTask[];
  weeklyTargets: WeeklyMilestone[];
  monthlyMilestones: MonthlyMilestone[];
} {
  const allSubTopics: ScheduledStudyTask[] = [];

  // Sort syllabi by earliest deadline first so urgent subjects get scheduled earlier
  const sortedSyllabi = [...syllabi].sort((a, b) => a.deadlineDate.localeCompare(b.deadlineDate));

  // Interleave sub-topics across subjects so the student studies a balanced mix each week
  const queuesBySyllabus = sortedSyllabi.map((plan) => {
    const items: ScheduledStudyTask[] = [];
    for (const ch of plan.chapters) {
      for (const st of ch.subTopics) {
        items.push({
          subTopicId: st.id,
          chapterId: ch.id,
          subject: plan.subject,
          chapterTitle: ch.title,
          subTopicTitle: st.title,
          estimatedMinutes: st.estimatedMinutes || 60,
          difficulty: st.difficulty,
          ncertReference: st.ncertReference,
          scheduledDate: st.completed && st.scheduledDate ? st.scheduledDate : startDateStr,
          completed: st.completed,
          quizScorePercent: st.quizScorePercent,
        });
      }
    }
    return items;
  });

  const interleavedPending: ScheduledStudyTask[] = [];
  const completedTasks: ScheduledStudyTask[] = [];

  let hasMore = true;
  let pointer = 0;
  while (hasMore) {
    hasMore = false;
    for (const q of queuesBySyllabus) {
      if (pointer < q.length) {
        hasMore = true;
        const item = q[pointer];
        if (item.completed) {
          completedTasks.push(item);
        } else {
          interleavedPending.push(item);
        }
      }
    }
    pointer++;
  }

  // Assign pending sub-topics day by day according to that day's available self-study minutes
  let dayOffset = 0;
  let currentDate = startDateStr;
  let dayAvailableMinutes =
    calculateDailyAvailableStudyHours(profile, currentDate, holidays).availableHours * 60;
  let dayUsedMinutes = 0;

  for (const task of interleavedPending) {
    // If adding this task exceeds today's capacity and we already scheduled at least one task today, advance to next day
    if (dayUsedMinutes > 0 && dayUsedMinutes + task.estimatedMinutes > dayAvailableMinutes) {
      dayOffset++;
      currentDate = addDaysToDateString(startDateStr, dayOffset);
      dayAvailableMinutes =
        calculateDailyAvailableStudyHours(profile, currentDate, holidays).availableHours * 60;
      dayUsedMinutes = 0;
    }
    task.scheduledDate = currentDate;
    dayUsedMinutes += task.estimatedMinutes;
    allSubTopics.push(task);
  }

  const combinedTasks = [...completedTasks, ...allSubTopics].sort((a, b) =>
    a.scheduledDate.localeCompare(b.scheduledDate)
  );

  // Build Weekly Milestones
  const weeklyMap = new Map<number, ScheduledStudyTask[]>();
  for (const task of combinedTasks) {
    const [sy, sm, sd] = startDateStr.split('-').map(Number);
    const [ty, tm, td] = task.scheduledDate.split('-').map(Number);
    const startUtc = Date.UTC(sy, (sm || 1) - 1, sd || 1);
    const taskUtc = Date.UTC(ty, (tm || 1) - 1, td || 1);
    const diffDays = Math.max(0, Math.floor((taskUtc - startUtc) / (1000 * 60 * 60 * 24)));
    const weekIndex = Math.floor(diffDays / 7) + 1;
    const list = weeklyMap.get(weekIndex) || [];
    list.push(task);
    weeklyMap.set(weekIndex, list);
  }

  const weeklyTargets: WeeklyMilestone[] = Array.from(weeklyMap.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([weekNumber, tasks]) => {
      const wStart = addDaysToDateString(startDateStr, (weekNumber - 1) * 7);
      const wEnd = addDaysToDateString(startDateStr, weekNumber * 7 - 1);
      const chaptersCovered = Array.from(new Set(tasks.map((t) => `${t.subject}: ${t.chapterTitle}`)));
      const totalMinutes = tasks.reduce((acc, t) => acc + t.estimatedMinutes, 0);
      const completedCount = tasks.filter((t) => t.completed).length;
      const shortChapterNames = Array.from(
        new Set(tasks.map((t) => t.chapterTitle.replace(/^Chapter\s+\d+:\s*/i, '')))
      ).slice(0, 3);

      return {
        weekNumber,
        startDate: wStart,
        endDate: wEnd,
        summaryText: `Week ${weekNumber}: Complete ${shortChapterNames.join(' & ')} to stay on track for your deadline`,
        totalMinutes,
        chaptersCovered,
        tasksCount: tasks.length,
        completedCount,
      };
    });

  // Build Monthly Milestones
  const monthMap = new Map<string, ScheduledStudyTask[]>();
  for (const task of combinedTasks) {
    const [y, m] = task.scheduledDate.split('-').map(Number);
    const dt = new Date(Date.UTC(y, (m || 1) - 1, 1));
    const label = dt.toLocaleDateString('en-IN', {
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    });
    const list = monthMap.get(label) || [];
    list.push(task);
    monthMap.set(label, list);
  }

  const monthlyMilestones: MonthlyMilestone[] = Array.from(monthMap.entries()).map(
    ([monthLabel, tasks]) => {
      const targetChapters = Array.from(new Set(tasks.map((t) => `${t.subject} — ${t.chapterTitle}`)));
      const totalMinutes = tasks.reduce((acc, t) => acc + t.estimatedMinutes, 0);
      const completedCount = tasks.filter((t) => t.completed).length;
      return {
        monthLabel,
        targetChapters,
        totalHours: Math.round((totalMinutes / 60) * 10) / 10,
        completionPercent:
          tasks.length > 0 ? Math.round((completedCount / tasks.length) * 100) : 0,
      };
    }
  );

  return {
    dailyTasks: combinedTasks,
    weeklyTargets,
    monthlyMilestones,
  };
}

/**
 * Evaluates quiz answers and identifies weak-point questions.
 */
export function evaluateQuizAnswers(
  questions: QuizQuestion[],
  selectedIndices: number[]
): {
  score: number;
  total: number;
  accuracyPercent: number;
  wrongQuestions: QuizQuestion[];
} {
  if (questions.length === 0) {
    return { score: 0, total: 0, accuracyPercent: 0, wrongQuestions: [] };
  }
  let score = 0;
  const wrongQuestions: QuizQuestion[] = [];

  questions.forEach((q, idx) => {
    if (selectedIndices[idx] === q.correctIndex) {
      score++;
    } else {
      wrongQuestions.push(q);
    }
  });

  const accuracyPercent = Math.round((score / questions.length) * 100);
  return {
    score,
    total: questions.length,
    accuracyPercent,
    wrongQuestions,
  };
}

/**
 * Calculates the "90/100 Grader" Projected Exam Score per subject using:
 * (a) Syllabus completion pace vs. deadline (40% weight)
 * (b) Post-topic Quiz accuracy (40% weight)
 * (c) School/Tuition revision overlap (20% weight)
 */
export function calculateSubjectProjectedScore(
  subject: string,
  profile: StudentProfile,
  syllabi: SyllabusPlan[],
  quizHistory: QuizSubmission[],
  schoolTuitionLogs: SchoolTuitionLog[],
  currentDateStr: string
): {
  subject: string;
  projectedScore: number;
  completionPercent: number;
  paceScore: number;
  quizAccuracy: number;
  revisionOverlapPercent: number;
  remainingSubTopics: number;
  totalSubTopics: number;
} {
  const subjectPlans = syllabi.filter(
    (s) => s.subject.toLowerCase() === subject.toLowerCase()
  );
  const allSubTopics = subjectPlans.flatMap((p) => p.chapters.flatMap((c) => c.subTopics));
  const totalSubTopics = allSubTopics.length;
  const completedSubTopics = allSubTopics.filter((st) => st.completed).length;
  const remainingSubTopics = Math.max(0, totalSubTopics - completedSubTopics);

  const completionPercent =
    totalSubTopics > 0 ? Math.round((completedSubTopics / totalSubTopics) * 100) : 0;

  // (a) Pace score relative to target percentage
  const baseTarget = profile.targetPercentage || 90;
  const paceScore =
    totalSubTopics === 0
      ? Math.round(baseTarget * 0.78)
      : Math.min(100, Math.round(baseTarget * 0.75 + completionPercent * 0.25));

  // (b) Quiz accuracy for this subject
  const subjectQuizzes = quizHistory.filter(
    (q) => q.subject.toLowerCase() === subject.toLowerCase()
  );
  const quizAccuracy =
    subjectQuizzes.length > 0
      ? Math.round(
          subjectQuizzes.reduce((acc, q) => acc + q.accuracyPercent, 0) /
            subjectQuizzes.length
        )
      : paceScore;

  // (c) School & Tuition revision alignment
  const subjectLogs = schoolTuitionLogs.filter(
    (l) => l.subject.toLowerCase() === subject.toLowerCase()
  );
  const alignedLogs = subjectLogs.filter(
    (l) => l.revisionCompleted || Boolean(l.alignedSubTopicId)
  );
  const revisionOverlapPercent =
    subjectLogs.length > 0
      ? Math.round((alignedLogs.length / subjectLogs.length) * 100)
      : completionPercent > 0
      ? 80
      : 0;

  // If no syllabus or quizzes exist yet for this subject, return 0 so we don't show fake numbers
  if (totalSubTopics === 0 && subjectQuizzes.length === 0 && subjectLogs.length === 0) {
    return {
      subject,
      projectedScore: 0,
      completionPercent: 0,
      paceScore: 0,
      quizAccuracy: 0,
      revisionOverlapPercent: 0,
      remainingSubTopics: 0,
      totalSubTopics: 0,
    };
  }

  const effectiveOverlap = subjectLogs.length > 0 ? revisionOverlapPercent : paceScore;
  const weighted =
    paceScore * 0.4 + quizAccuracy * 0.4 + effectiveOverlap * 0.2;
  const projectedScore = Math.max(35, Math.min(100, Math.round(weighted)));

  return {
    subject,
    projectedScore,
    completionPercent,
    paceScore,
    quizAccuracy: subjectQuizzes.length > 0 ? quizAccuracy : 0,
    revisionOverlapPercent: subjectLogs.length > 0 ? revisionOverlapPercent : 0,
    remainingSubTopics,
    totalSubTopics,
  };
}

/**
 * Calculates overall projected score across active subjects.
 */
export function calculateOverallProjectedScore(
  subjectScores: { projectedScore: number }[]
): number {
  const active = subjectScores.filter((s) => s.projectedScore > 0);
  if (active.length === 0) return 0;
  const sum = active.reduce((acc, s) => acc + s.projectedScore, 0);
  return Math.round(sum / active.length);
}

/**
 * Correlates Google Fit / boAt Smartwatch vitals with study session load.
 */
export function computeBioFeedbackCorrelation(health: HealthMetrics | null): {
  statusLabel: 'OPTIMAL READINESS' | 'MODERATE FATIGUE' | 'RECOVERY NEEDED' | 'AWAITING SYNC';
  recommendedBlockMinutes: number;
  summary: string;
} {
  if (!health) {
    return {
      statusLabel: 'AWAITING SYNC',
      recommendedBlockMinutes: 60,
      summary:
        'Connect Google Fit (boAt Smartwatch Sync) or log today’s vitals to personalize study block intensity based on your sleep and heart rate.',
    };
  }

  if (health.sleepHours < 6 || health.heartRateBpm > 95) {
    return {
      statusLabel: 'RECOVERY NEEDED',
      recommendedBlockMinutes: 40,
      summary: `Sleep duration (${health.sleepHours} hrs) or resting heart rate (${health.heartRateBpm} BPM) indicates elevated fatigue. Shift heavy 5-mark derivations to tomorrow morning and focus on 40-minute NCERT formula revision blocks tonight.`,
    };
  }

  if (health.sleepHours < 7) {
    return {
      statusLabel: 'MODERATE FATIGUE',
      recommendedBlockMinutes: 50,
      summary: `With ${health.sleepHours} hrs sleep and ${health.steps.toLocaleString('en-IN')} steps, use 50-minute Pomodoro blocks with 10-minute hydration breaks between numerical problem sets.`,
    };
  }

  return {
    statusLabel: 'OPTIMAL READINESS',
    recommendedBlockMinutes: 90,
    summary: `Restorative sleep (${health.sleepHours} hrs), ${health.steps.toLocaleString('en-IN')} steps, and steady ${health.heartRateBpm} BPM heart rate detected. Ideal physiological window for tackling high-weightage calculus/physics numericals in 90-minute deep-work blocks.`,
  };
}

/**
 * Converts raw LaTeX backslash sequences into clean Unicode mathematical notation
 * for readable rendering in both DOM and jsPDF documents.
 */
export function formatMathText(input: string): string {
  if (!input) return '';
  return input
    .replace(/\$/g, '')
    .replace(/\\frac\{([^{}]+)\}\{([^{}]+)\}/g, '($1) / ($2)')
    .replace(/\\sqrt\{([^{}]+)\}/g, '√($1)')
    .replace(/\\int/g, '∫')
    .replace(/\\theta/g, 'θ')
    .replace(/\\pi/g, 'π')
    .replace(/\\alpha/g, 'α')
    .replace(/\\beta/g, 'β')
    .replace(/\\gamma/g, 'γ')
    .replace(/\\Delta/g, 'Δ')
    .replace(/\\lambda/g, 'λ')
    .replace(/\\omega/g, 'ω')
    .replace(/\\infty/g, '∞')
    .replace(/\\pm/g, '±')
    .replace(/\\times/g, '×')
    .replace(/\\cdot/g, '·')
    .replace(/\\leq/g, '≤')
    .replace(/\\geq/g, '≥')
    .replace(/\\neq/g, '≠')
    .replace(/\\rightarrow|\\to/g, '→')
    .replace(/\\left|\\right/g, '')
    .replace(/\\(sin|cos|tan|sec|csc|cot|log|ln|lim)/g, '$1')
    .replace(/\^2/g, '²')
    .replace(/\^3/g, '³')
    .replace(/\s+/g, ' ')
    .trim();
}

