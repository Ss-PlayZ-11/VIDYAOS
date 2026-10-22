export type IndianBoard = 'CBSE' | 'ICSE' | 'State Board' | 'JEE/NEET/CET';

export type StudentGrade =
  | 'Class 9'
  | 'Class 10'
  | 'Class 11'
  | 'Class 12'
  | 'Competitive / Dropper / College';

export type DayOfWeek = 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun';

export interface SchoolSchedule {
  startTime: string; // e.g. "07:30"
  endTime: string;   // e.g. "14:00"
  activeDays: DayOfWeek[];
}

export interface TuitionBatch {
  id: string;
  subject: string;
  startTime: string; // e.g. "16:30"
  endTime: string;   // e.g. "19:30"
  activeDays: DayOfWeek[];
}

export interface SleepWindow {
  bedTime: string;  // e.g. "23:00"
  wakeTime: string; // e.g. "06:00"
  preferredStudySlot: 'Morning Peak (5:30 AM – 7:00 AM)' | 'Night Focus (8:30 PM – 11:00 PM)' | 'Balanced Split (Morning + Evening)';
}

export interface StudentProfile {
  name: string;
  grade: StudentGrade;
  board: IndianBoard;
  targetPercentage: number;
  subjects: string[];
  schoolSchedule: SchoolSchedule;
  tuitionBatches: TuitionBatch[];
  sleepWindow: SleepWindow;
  customOAuthClientId?: string;
  notificationsEnabled: boolean;
  onboardedAt: string;
}

export interface SubTopicItem {
  id: string;
  chapterId: string;
  chapterTitle: string;
  subject: string;
  title: string;
  estimatedMinutes: number;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  ncertReference: string;
  completed: boolean;
  completedAt?: string;
  scheduledDate?: string; // YYYY-MM-DD in IST
  quizScorePercent?: number;
}

export interface ChapterItem {
  id: string;
  subject: string;
  title: string;
  weightageMarks: number;
  estimatedHours: number;
  subTopics: SubTopicItem[];
}

export interface SyllabusPlan {
  id: string;
  subject: string;
  curriculumTitle: string;
  deadlineDate: string; // YYYY-MM-DD
  createdAt: string;
  chapters: ChapterItem[];
}

export interface HolidayDate {
  date: string; // YYYY-MM-DD
  label: string;
  noSchool: boolean;
  noTuition: boolean;
}

export interface ScheduledStudyTask {
  subTopicId: string;
  chapterId: string;
  subject: string;
  chapterTitle: string;
  subTopicTitle: string;
  estimatedMinutes: number;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  ncertReference: string;
  scheduledDate: string;
  completed: boolean;
  quizScorePercent?: number;
}

export interface WeeklyMilestone {
  weekNumber: number;
  startDate: string;
  endDate: string;
  summaryText: string;
  totalMinutes: number;
  chaptersCovered: string[];
  tasksCount: number;
  completedCount: number;
}

export interface MonthlyMilestone {
  monthLabel: string; // e.g. "October 2026"
  targetChapters: string[];
  totalHours: number;
  completionPercent: number;
}

export interface QuizQuestion {
  id: string;
  question: string;
  type: 'mcq' | 'numerical';
  options: string[];
  correctIndex: number;
  conceptTag: string;
  explanation: string;
  formulaUsed: string;
}

export interface WeakPointSummary {
  id: string;
  subTopicId: string;
  subject: string;
  chapterTitle: string;
  subTopicTitle: string;
  date: string;
  accuracyPercent: number;
  weakSubTopics: string[];
  coreConceptSummary: string;
  keyFormulas: string[];
  ncertExamTips: string[];
  remediationSteps: string[];
}

export interface QuizSubmission {
  id: string;
  subTopicId: string;
  subject: string;
  chapterTitle: string;
  subTopicTitle: string;
  date: string;
  score: number;
  total: number;
  accuracyPercent: number;
  weakPointSummary?: WeakPointSummary;
}

export interface SchoolTuitionLog {
  id: string;
  date: string; // YYYY-MM-DD
  source: 'School' | 'Tuition';
  subject: string;
  chapterTaught: string;
  topicTaught: string;
  alignedSubTopicId?: string;
  alignedSubTopicTitle?: string;
  revisionCompleted: boolean;
}

export interface HealthMetrics {
  date: string; // YYYY-MM-DD
  steps: number;
  heartRateBpm: number;
  caloriesBurned: number;
  sleepHours: number;
  syncedFrom: 'Google Fit (boAt Smartwatch Sync)' | 'boAt Crest Manual Entry';
  syncedAt: string;
}

export interface DailyNoteDocument {
  id: string;
  date: string;
  title: string;
  executiveSummary: string;
  keyDefinitions: string[];
  essentialFormulas: string[];
  ncertExamTips: string[];
  weakAreaActionPlan: string[];
  driveFileId?: string;
  driveFolderName?: string;
  generatedAt: string;
}
