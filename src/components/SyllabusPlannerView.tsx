import React, { useState } from 'react';
import {
  BookOpen,
  Calendar,
  FileUp,
  Loader2,
  Plus,
  Sun,
  Trash2,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';
import type {
  ChapterItem,
  HolidayDate,
  MonthlyMilestone,
  ScheduledStudyTask,
  StudentProfile,
  SyllabusPlan,
  WeeklyMilestone,
} from '../types/vidya';
import {
  addDaysToDateString,
  calculateDailyAvailableStudyHours,
} from '../utils/studyEngine';

interface SyllabusPlannerViewProps {
  profile: StudentProfile;
  currentDateStr: string;
  syllabi: SyllabusPlan[];
  holidays: HolidayDate[];
  dailyTasks: ScheduledStudyTask[];
  weeklyTargets: WeeklyMilestone[];
  monthlyMilestones: MonthlyMilestone[];
  onAddSyllabus: (plan: SyllabusPlan) => void;
  onDeleteSyllabus: (id: string) => void;
  onToggleHoliday: (holiday: HolidayDate) => void;
  onRemoveHoliday: (dateStr: string) => void;
  onToggleTaskCompletion: (subTopicId: string) => void;
}

const INDIAN_FESTIVAL_PRESETS = [
  'Diwali / Deepavali Study Break',
  'Dussehra / Vijayadashami Holiday',
  'Holi Festival Holiday',
  'Republic Day / National Holiday',
  'Ganesh Chaturthi / Navratri Break',
  'Board Exam Preparatory Leave (No School)',
  'Coaching Test Series Off-Day',
];

export const SyllabusPlannerView: React.FC<SyllabusPlannerViewProps> = ({
  profile,
  currentDateStr,
  syllabi,
  holidays,
  dailyTasks,
  weeklyTargets,
  monthlyMilestones,
  onAddSyllabus,
  onDeleteSyllabus,
  onToggleHoliday,
  onRemoveHoliday,
  onToggleTaskCompletion,
}) => {
  const [selectedSubject, setSelectedSubject] = useState<string>(
    profile.subjects[0] || 'Mathematics'
  );
  const [promptText, setPromptText] = useState<string>('');
  const [deadlineDate, setDeadlineDate] = useState<string>(
    addDaysToDateString(currentDateStr, 45)
  );
  const [uploadedFileName, setUploadedFileName] = useState<string>('');
  const [uploadedFileData, setUploadedFileData] = useState<{
    mimeType: string;
    base64Data: string;
  } | null>(null);
  const [isParsing, setIsParsing] = useState<boolean>(false);
  const [parseError, setParseError] = useState<string>('');

  // Holiday Rescheduler state
  const [holidayDateInput, setHolidayDateInput] = useState<string>(currentDateStr);
  const [holidayLabelInput, setHolidayLabelInput] = useState<string>(
    INDIAN_FESTIVAL_PRESETS[0]
  );
  const [holidayNoSchool, setHolidayNoSchool] = useState<boolean>(true);
  const [holidayNoTuition, setHolidayNoTuition] = useState<boolean>(true);

  const [activeBreakdownTab, setActiveBreakdownTab] = useState<
    'daily' | 'weekly' | 'monthly' | 'chapters'
  >('weekly');

  const todayCapacity = calculateDailyAvailableStudyHours(
    profile,
    currentDateStr,
    holidays
  );
  const isTodayHoliday = holidays.some((h) => h.date === currentDateStr);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadedFileName(file.name);

    if (file.type.startsWith('text/')) {
      const text = await file.text();
      setPromptText((prev) => (prev ? `${prev}\n${text}` : text));
      setUploadedFileData(null);
    } else {
      const reader = new FileReader();
      reader.onload = () => {
        const result = String(reader.result || '');
        const base64 = result.includes(',') ? result.split(',')[1] : result;
        setUploadedFileData({
          mimeType: file.type || 'application/pdf',
          base64Data: base64,
        });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleParseSyllabus = async (e: React.FormEvent) => {
    e.preventDefault();
    setParseError('');
    if (!promptText.trim() && !uploadedFileData) {
      setParseError(
        'Please enter your textbook/syllabus prompt (e.g., "NCERT Class 12 Maths Part 2 - 9 Chapters") or upload a syllabus file.'
      );
      return;
    }
    if (!deadlineDate) {
      setParseError('Please select a Target Completion Deadline Date.');
      return;
    }

    setIsParsing(true);
    try {
      const res = await fetch('/api/ai/parse-syllabus', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: selectedSubject,
          board: profile.board,
          grade: profile.grade,
          promptText: promptText.trim(),
          deadlineDate,
          fileData: uploadedFileData,
        }),
      });

      if (!res.ok) {
        throw new Error(`Syllabus parser returned status ${res.status}`);
      }

      const data = await res.json();
      const nowId = Date.now();
      const chapters: ChapterItem[] = (data.chapters || []).map(
        (ch: any, cIdx: number) => {
          const chId = `ch-${nowId}-${cIdx}`;
          return {
            id: chId,
            subject: selectedSubject,
            title: ch.title || `Chapter ${cIdx + 1}`,
            weightageMarks: Number(ch.weightageMarks) || 8,
            estimatedHours: Number(ch.estimatedHours) || 4,
            subTopics: (ch.subTopics || []).map((st: any, sIdx: number) => ({
              id: `st-${nowId}-${cIdx}-${sIdx}`,
              chapterId: chId,
              chapterTitle: ch.title || `Chapter ${cIdx + 1}`,
              subject: selectedSubject,
              title: st.title || `Sub-topic ${sIdx + 1}`,
              estimatedMinutes: Number(st.estimatedMinutes) || 60,
              difficulty:
                st.difficulty === 'Easy' || st.difficulty === 'Hard'
                  ? st.difficulty
                  : 'Medium',
              ncertReference: st.ncertReference || `${profile.board} Core Exercise`,
              completed: false,
            })),
          };
        }
      );

      const newPlan: SyllabusPlan = {
        id: `plan-${nowId}`,
        subject: selectedSubject,
        curriculumTitle:
          data.curriculumTitle || `${profile.board} ${profile.grade} — ${selectedSubject}`,
        deadlineDate,
        createdAt: currentDateStr,
        chapters,
      };

      onAddSyllabus(newPlan);
      setPromptText('');
      setUploadedFileName('');
      setUploadedFileData(null);
    } catch (err: any) {
      setParseError(err?.message || 'Failed to parse syllabus. Please try again.');
    } finally {
      setIsParsing(false);
    }
  };

  const handleQuickToggleTodayHoliday = () => {
    if (isTodayHoliday) {
      onRemoveHoliday(currentDateStr);
    } else {
      onToggleHoliday({
        date: currentDateStr,
        label: 'No-School / Festival Study Day',
        noSchool: true,
        noTuition: false,
      });
    }
  };

  const handleAddCustomHoliday = (e: React.FormEvent) => {
    e.preventDefault();
    if (!holidayDateInput) return;
    onToggleHoliday({
      date: holidayDateInput,
      label: holidayLabelInput || 'Holiday / No-School Day',
      noSchool: holidayNoSchool,
      noTuition: holidayNoTuition,
    });
  };

  return (
    <div className="space-y-8">
      {/* Top Split: AI Syllabus Parser + Dynamic Holiday Rescheduler */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Left 7 Cols: AI Syllabus Upload & Detection */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900 tracking-tight">
                  AI Syllabus Parser & Chapter Extractor
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Powered by Gemini Structured JSON Output · Extracts chapters, board weightage & NCERT sub-topics
                </p>
              </div>
              <BookOpen className="w-5 h-5 text-indigo-600 shrink-0" />
            </div>

            {parseError && (
              <div
                role="alert"
                className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-xs font-medium text-red-700"
              >
                {parseError}
              </div>
            )}

            <form onSubmit={handleParseSyllabus} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="syllabus-subject"
                    className="block text-xs font-semibold text-slate-700 mb-1.5"
                  >
                    Target Subject
                  </label>
                  <select
                    id="syllabus-subject"
                    value={selectedSubject}
                    onChange={(e) => setSelectedSubject(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-600"
                  >
                    {profile.subjects.map((subj) => (
                      <option key={subj} value={subj}>
                        {subj}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="syllabus-deadline"
                    className="block text-xs font-semibold text-slate-700 mb-1.5"
                  >
                    Target Completion Deadline Date
                  </label>
                  <input
                    id="syllabus-deadline"
                    type="date"
                    value={deadlineDate}
                    min={currentDateStr}
                    onChange={(e) => setDeadlineDate(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg font-mono tabular-nums focus:outline-none focus:ring-2 focus:ring-indigo-600"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="syllabus-prompt"
                  className="block text-xs font-semibold text-slate-700 mb-1.5"
                >
                  Textbook Prompt or Chapter Index List
                </label>
                <textarea
                  id="syllabus-prompt"
                  rows={3}
                  value={promptText}
                  onChange={(e) => {
                    setPromptText(e.target.value);
                    setParseError('');
                  }}
                  placeholder='e.g., "NCERT Class 12 Maths Part 2 - Integrals, Application of Integrals, Differential Equations, Vector Algebra, 3D Geometry"'
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-600"
                />
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                <div className="flex items-center gap-3">
                  <label
                    htmlFor="syllabus-file-upload"
                    className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 border border-slate-300 rounded-lg hover:bg-slate-200 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <FileUp className="w-4 h-4 text-slate-600" />
                    <span>
                      {uploadedFileName
                        ? `Attached: ${uploadedFileName.slice(0, 22)}`
                        : 'Upload Syllabus PDF / Image / TXT'}
                    </span>
                  </label>
                  <input
                    id="syllabus-file-upload"
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg,.txt"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isParsing}
                  className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-xs font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-60 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                >
                  {isParsing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Extracting Chapters with Gemini...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>Extract Syllabus & Build Plan</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* Quick Preset Prompts for Indian Curriculum */}
          <div className="mt-5 pt-4 border-t border-slate-200 flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span className="font-semibold text-slate-700">Quick NCERT Prompts:</span>
            <button
              type="button"
              onClick={() =>
                setPromptText(
                  'NCERT Class 12 Maths Part 2 - Integrals, Application of Integrals, Differential Equations, Vector Algebra, 3D Geometry'
                )
              }
              className="text-indigo-600 hover:underline cursor-pointer"
            >
              NCERT Class 12 Maths Part 2
            </button>
            <span aria-hidden="true">·</span>
            <button
              type="button"
              onClick={() =>
                setPromptText(
                  'NCERT Physics Part 1 - Electric Charges & Fields, Electrostatic Potential & Capacitance, Current Electricity'
                )
              }
              className="text-indigo-600 hover:underline cursor-pointer"
            >
              NCERT Physics Electrostatics & Current
            </button>
          </div>
        </div>

        {/* Right 5 Cols: Holiday & "No School / No Tuition" Dynamic Rescheduler */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-slate-900 tracking-tight">
                  Holiday & No-School Dynamic Rescheduler
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Reclaims School/Tuition hours on festivals or prep holidays & rebalances your topic queue
                </p>
              </div>
              <Sun className="w-5 h-5 text-amber-600 shrink-0" />
            </div>

            {/* Prominent Today Toggle */}
            <div className="py-3.5 border-y border-slate-200 flex items-center justify-between gap-3">
              <div>
                <div className="text-xs font-semibold text-slate-900">
                  Today ({currentDateStr}) Capacity:{' '}
                  <span className="font-mono tabular-nums text-indigo-600">
                    {todayCapacity.availableHours} hrs
                  </span>
                </div>
                <div className="text-xs text-slate-500 mt-0.5">
                  {isTodayHoliday
                    ? 'Marked as Holiday — School hours reclaimed for self-study'
                    : `Regular Day (School: ${todayCapacity.schoolHours}h · Tuition: ${todayCapacity.tuitionHours}h)`}
                </div>
              </div>
              <button
                type="button"
                onClick={handleQuickToggleTodayHoliday}
                className={`px-3.5 py-2 text-xs font-semibold rounded-lg border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  isTodayHoliday
                    ? 'bg-amber-600 text-white border-amber-600 hover:bg-amber-700'
                    : 'bg-slate-900 text-white border-slate-900 hover:bg-slate-800'
                }`}
              >
                {isTodayHoliday ? 'Holiday Active (Revert)' : 'Mark Today as Holiday'}
              </button>
            </div>

            {/* Schedule Upcoming Holiday / No-School Day */}
            <form onSubmit={handleAddCustomHoliday} className="space-y-3 pt-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="holiday-date"
                    className="block text-xs font-medium text-slate-700 mb-1"
                  >
                    Select Date
                  </label>
                  <input
                    id="holiday-date"
                    type="date"
                    value={holidayDateInput}
                    onChange={(e) => setHolidayDateInput(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg font-mono tabular-nums"
                  />
                </div>
                <div>
                  <label
                    htmlFor="holiday-occasion"
                    className="block text-xs font-medium text-slate-700 mb-1"
                  >
                    Festival / Occasion
                  </label>
                  <select
                    id="holiday-occasion"
                    value={holidayLabelInput}
                    onChange={(e) => setHolidayLabelInput(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
                  >
                    {INDIAN_FESTIVAL_PRESETS.map((preset) => (
                      <option key={preset} value={preset}>
                        {preset}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-4 text-xs text-slate-700">
                  <label className="inline-flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={holidayNoSchool}
                      onChange={(e) => setHolidayNoSchool(e.target.checked)}
                      className="rounded border-slate-300 text-indigo-600"
                    />
                    <span>No School</span>
                  </label>
                  <label className="inline-flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={holidayNoTuition}
                      onChange={(e) => setHolidayNoTuition(e.target.checked)}
                      className="rounded border-slate-300 text-indigo-600"
                    />
                    <span>No Tuition</span>
                  </label>
                </div>

                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-slate-900 bg-slate-100 border border-slate-300 rounded-lg hover:bg-slate-200 cursor-pointer whitespace-nowrap shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Holiday & Rebalance</span>
                </button>
              </div>
            </form>
          </div>

          {/* Active Holidays List */}
          <div className="mt-4 pt-3 border-t border-slate-200">
            <div className="text-xs font-semibold text-slate-700 mb-2">
              Scheduled Holidays & Prep Days ({holidays.length})
            </div>
            {holidays.length === 0 ? (
              <p className="text-xs text-slate-500">
                No holidays marked yet. Toggle today or add upcoming Indian festival dates above to expand study capacity.
              </p>
            ) : (
              <div className="space-y-1.5 max-h-28 overflow-y-auto">
                {holidays.map((h) => (
                  <div
                    key={h.date}
                    className="flex items-center justify-between text-xs py-1 border-b border-slate-100 last:border-b-0"
                  >
                    <div className="truncate">
                      <span className="font-mono tabular-nums font-semibold text-slate-900">
                        {h.date}
                      </span>
                      <span aria-hidden="true" className="mx-1.5 text-slate-400">·</span>
                      <span className="text-slate-700">{h.label}</span>
                      <span aria-hidden="true" className="mx-1.5 text-slate-400">·</span>
                      <span className="text-emerald-700 font-medium">
                        {h.noSchool && h.noTuition
                          ? 'Full Study Day'
                          : h.noSchool
                          ? 'No School'
                          : 'No Tuition'}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => onRemoveHoliday(h.date)}
                      aria-label={`Remove holiday on ${h.date}`}
                      className="text-slate-400 hover:text-red-600 p-1 cursor-pointer shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Section: Automated Monthly, Weekly & Daily Breakdown */}
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-200">
          <div>
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">
              Dynamic Study Breakdown (Month · Week · Day)
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Automatically distributed outside your {profile.schoolSchedule.startTime}–{profile.schoolSchedule.endTime} School and Tuition slots
            </p>
          </div>

          {/* Interactive Segmented Control */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg self-start">
            <button
              type="button"
              onClick={() => setActiveBreakdownTab('weekly')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                activeBreakdownTab === 'weekly'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Weekly Targets ({weeklyTargets.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveBreakdownTab('monthly')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                activeBreakdownTab === 'monthly'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Monthly Milestones ({monthlyMilestones.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveBreakdownTab('daily')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                activeBreakdownTab === 'daily'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Daily Queue ({dailyTasks.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveBreakdownTab('chapters')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                activeBreakdownTab === 'chapters'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Syllabi ({syllabi.length})
            </button>
          </div>
        </div>

        {syllabi.length === 0 ? (
          <div className="py-12 text-center max-w-md mx-auto">
            <Calendar className="w-8 h-8 text-slate-400 mx-auto mb-3" />
            <h3 className="text-base font-semibold text-slate-900">
              No Syllabus Uploaded Yet
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Enter a textbook prompt (such as &ldquo;NCERT Class 12 Maths Part 2&rdquo;) or upload your syllabus PDF above to generate your Monthly, Weekly, and Daily study plan.
            </p>
          </div>
        ) : (
          <div className="pt-5">
            {activeBreakdownTab === 'weekly' && (
              <div className="space-y-4">
                {weeklyTargets.map((wk) => {
                  const pct =
                    wk.tasksCount > 0
                      ? Math.round((wk.completedCount / wk.tasksCount) * 100)
                      : 0;
                  return (
                    <div
                      key={wk.weekNumber}
                      className="p-4 rounded-lg border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                    >
                      <div className="space-y-1">
                        <div className="text-sm font-bold text-slate-900">
                          {wk.summaryText}
                        </div>
                        <div className="text-xs text-slate-500">
                          <span className="font-mono tabular-nums">
                            {wk.startDate} to {wk.endDate}
                          </span>
                          <span aria-hidden="true" className="mx-2">·</span>
                          <span className="font-mono tabular-nums">
                            {Math.round((wk.totalMinutes / 60) * 10) / 10} hrs total
                          </span>
                          <span aria-hidden="true" className="mx-2">·</span>
                          <span>{wk.chaptersCovered.join(' / ')}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-xs font-mono tabular-nums font-semibold text-slate-700">
                          {wk.completedCount}/{wk.tasksCount} sub-topics ({pct}%)
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {activeBreakdownTab === 'monthly' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {monthlyMilestones.map((mm) => (
                  <div
                    key={mm.monthLabel}
                    className="p-4 rounded-lg border border-slate-200 space-y-2.5"
                  >
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-bold text-slate-900">
                        {mm.monthLabel}
                      </h3>
                      <span className="text-xs font-mono tabular-nums font-semibold text-indigo-600">
                        {mm.totalHours} hrs · {mm.completionPercent}% done
                      </span>
                    </div>
                    <ul className="space-y-1 text-xs text-slate-600">
                      {mm.targetChapters.map((ch) => (
                        <li key={ch} className="truncate">
                          • {ch}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}

            {activeBreakdownTab === 'daily' && (
              <div className="divide-y divide-slate-200">
                {dailyTasks.map((task) => {
                  const isHolidayDate = holidays.some(
                    (h) => h.date === task.scheduledDate
                  );
                  return (
                    <div
                      key={task.subTopicId}
                      className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="flex items-start gap-3">
                        <button
                          type="button"
                          onClick={() => onToggleTaskCompletion(task.subTopicId)}
                          aria-label={`Mark ${task.subTopicTitle} as done`}
                          className={`mt-0.5 w-5 h-5 rounded border flex items-center justify-center transition-colors cursor-pointer shrink-0 ${
                            task.completed
                              ? 'bg-emerald-600 border-emerald-600 text-white'
                              : 'bg-white border-slate-300 hover:border-indigo-600'
                          }`}
                        >
                          {task.completed && <CheckCircle2 className="w-3.5 h-3.5" />}
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
                          <div className="text-xs text-slate-500 mt-0.5">
                            <span>{task.subject}</span>
                            <span aria-hidden="true" className="mx-1.5">·</span>
                            <span>{task.chapterTitle}</span>
                            <span aria-hidden="true" className="mx-1.5">·</span>
                            <span>{task.ncertReference}</span>
                            <span aria-hidden="true" className="mx-1.5">·</span>
                            <span>Difficulty: {task.difficulty}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 text-xs font-mono tabular-nums text-slate-600 shrink-0 pl-8 sm:pl-0">
                        <span>{task.estimatedMinutes} min</span>
                        <span aria-hidden="true">·</span>
                        <span
                          className={
                            isHolidayDate
                              ? 'text-amber-700 font-semibold'
                              : 'text-slate-700'
                          }
                        >
                          {task.scheduledDate}
                          {isHolidayDate ? ' (Holiday Slot)' : ''}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {activeBreakdownTab === 'chapters' && (
              <div className="space-y-4">
                {syllabi.map((plan) => (
                  <div
                    key={plan.id}
                    className="p-4 rounded-lg border border-slate-200 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-bold text-slate-900">
                          {plan.curriculumTitle}
                        </h3>
                        <p className="text-xs text-slate-500 font-mono tabular-nums">
                          Subject: {plan.subject} · Target Deadline: {plan.deadlineDate} · {plan.chapters.length} Chapters
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => onDeleteSyllabus(plan.id)}
                        aria-label={`Delete ${plan.curriculumTitle}`}
                        className="text-xs text-red-600 hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Remove</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
