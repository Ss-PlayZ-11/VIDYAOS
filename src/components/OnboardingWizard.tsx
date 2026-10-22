import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowRight,
  ArrowLeft,
  BookOpen,
  Clock,
  GraduationCap,
  Plus,
  Trash2,
  CheckCircle2,
} from 'lucide-react';
import type {
  DayOfWeek,
  IndianBoard,
  StudentGrade,
  StudentProfile,
  TuitionBatch,
} from '../types/vidya';
import { calculateDailyAvailableStudyHours } from '../utils/studyEngine';

interface OnboardingWizardProps {
  onComplete: (profile: StudentProfile) => void;
}

const ALL_DAYS: DayOfWeek[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const SUGGESTED_SUBJECTS_BY_STREAM = [
  'Physics',
  'Chemistry',
  'Mathematics Part 1',
  'Mathematics Part 2',
  'Biology',
  'English Core',
  'Computer Science',
  'Accountancy',
  'Economics',
  'Business Studies',
  'History & Civics',
  'Geography',
];

export const OnboardingWizard: React.FC<OnboardingWizardProps> = ({ onComplete }) => {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [errorMsg, setErrorMsg] = useState<string>('');

  // Step 1: Student Details
  const [name, setName] = useState<string>('');
  const [grade, setGrade] = useState<StudentGrade>('Class 12');
  const [board, setBoard] = useState<IndianBoard>('CBSE');
  const [targetPercentage, setTargetPercentage] = useState<number>(95);

  // Step 2: Subjects
  const [subjects, setSubjects] = useState<string[]>([]);
  const [customSubject, setCustomSubject] = useState<string>('');

  // Step 3: Indian School, Tuition & Sleep Schedule
  const [schoolStart, setSchoolStart] = useState<string>('07:30');
  const [schoolEnd, setSchoolEnd] = useState<string>('14:00');
  const [schoolDays, setSchoolDays] = useState<DayOfWeek[]>([
    'Mon',
    'Tue',
    'Wed',
    'Thu',
    'Fri',
    'Sat',
  ]);

  const [tuitionBatches, setTuitionBatches] = useState<TuitionBatch[]>([]);
  const [newTuitionSubject, setNewTuitionSubject] = useState<string>('');
  const [newTuitionStart, setNewTuitionStart] = useState<string>('16:30');
  const [newTuitionEnd, setNewTuitionEnd] = useState<string>('19:30');
  const [newTuitionDays, setNewTuitionDays] = useState<DayOfWeek[]>([
    'Mon',
    'Tue',
    'Wed',
    'Thu',
    'Fri',
    'Sat',
  ]);

  const [bedTime, setBedTime] = useState<string>('23:00');
  const [wakeTime, setWakeTime] = useState<string>('06:00');
  const [preferredStudySlot, setPreferredStudySlot] = useState<
    | 'Morning Peak (5:30 AM – 7:00 AM)'
    | 'Night Focus (8:30 PM – 11:00 PM)'
    | 'Balanced Split (Morning + Evening)'
  >('Balanced Split (Morning + Evening)');

  const toggleSubject = (subj: string) => {
    setErrorMsg('');
    if (subjects.includes(subj)) {
      setSubjects(subjects.filter((s) => s !== subj));
    } else {
      setSubjects([...subjects, subj]);
    }
  };

  const handleAddCustomSubject = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = customSubject.trim();
    if (!trimmed) return;
    if (!subjects.includes(trimmed)) {
      setSubjects([...subjects, trimmed]);
    }
    setCustomSubject('');
    setErrorMsg('');
  };

  const toggleSchoolDay = (day: DayOfWeek) => {
    if (schoolDays.includes(day)) {
      setSchoolDays(schoolDays.filter((d) => d !== day));
    } else {
      setSchoolDays([...schoolDays, day]);
    }
  };

  const toggleTuitionDay = (day: DayOfWeek) => {
    if (newTuitionDays.includes(day)) {
      setNewTuitionDays(newTuitionDays.filter((d) => d !== day));
    } else {
      setNewTuitionDays([...newTuitionDays, day]);
    }
  };

  const handleAddTuitionBatch = () => {
    const subj = newTuitionSubject || subjects[0] || 'Coaching Batch';
    const batch: TuitionBatch = {
      id: `tuition-${Date.now()}`,
      subject: subj,
      startTime: newTuitionStart,
      endTime: newTuitionEnd,
      activeDays: newTuitionDays.length > 0 ? newTuitionDays : ['Mon', 'Wed', 'Fri'],
    };
    setTuitionBatches([...tuitionBatches, batch]);
    setNewTuitionSubject('');
  };

  const handleRemoveTuitionBatch = (id: string) => {
    setTuitionBatches(tuitionBatches.filter((b) => b.id !== id));
  };

  const handleNextStep = () => {
    setErrorMsg('');
    if (step === 1) {
      if (!name.trim()) {
        setErrorMsg('Please enter your full name to personalize your VidyaOS study companion.');
        return;
      }
      if (targetPercentage < 50 || targetPercentage > 100 || Number.isNaN(targetPercentage)) {
        setErrorMsg('Please enter a realistic target percentage between 50% and 100%.');
        return;
      }
      setStep(2);
    } else if (step === 2) {
      if (subjects.length === 0) {
        setErrorMsg('Please select or add at least one subject from your curriculum.');
        return;
      }
      if (!newTuitionSubject && subjects.length > 0) {
        setNewTuitionSubject(subjects[0]);
      }
      setStep(3);
    }
  };

  const previewProfile: StudentProfile = {
    name: name.trim() || 'Student',
    grade,
    board,
    targetPercentage,
    subjects,
    schoolSchedule: {
      startTime: schoolStart,
      endTime: schoolEnd,
      activeDays: schoolDays,
    },
    tuitionBatches,
    sleepWindow: {
      bedTime,
      wakeTime,
      preferredStudySlot,
    },
    notificationsEnabled: false,
    onboardedAt: new Date().toISOString(),
  };

  // Sample weekday calculation (2026-10-22 is Thursday)
  const weekdayCalc = calculateDailyAvailableStudyHours(previewProfile, '2026-10-22', []);
  const sundayCalc = calculateDailyAvailableStudyHours(previewProfile, '2026-10-25', []);

  const handleFinishOnboarding = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || subjects.length === 0) {
      setErrorMsg('Please complete all required student profile details.');
      return;
    }
    onComplete(previewProfile);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col justify-between">
      {/* Clean Top Bar */}
      <header className="border-b border-slate-200 bg-white px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <span className="text-lg font-bold tracking-tight text-slate-900">
            VidyaOS
          </span>
          <span className="text-xs font-medium text-slate-500 font-mono tabular-nums">
            Indian Student Companion · Setup Step {step} of 3
          </span>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-3xl bg-white border border-slate-200 rounded-xl p-6 sm:p-10 shadow-xs">
          {/* Step Progress Header */}
          <div className="mb-8">
            <div className="flex items-center justify-between text-xs font-medium text-slate-500 mb-3">
              <span className={step >= 1 ? 'text-indigo-600 font-semibold' : ''}>
                01. Academic Profile & Board
              </span>
              <span aria-hidden="true">·</span>
              <span className={step >= 2 ? 'text-indigo-600 font-semibold' : ''}>
                02. Curriculum Subjects
              </span>
              <span aria-hidden="true">·</span>
              <span className={step >= 3 ? 'text-indigo-600 font-semibold' : ''}>
                03. School, Tuition & IST Timings
              </span>
            </div>
            <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-indigo-600 transition-all duration-300"
                style={{ width: `${(step / 3) * 100}%` }}
              />
            </div>
          </div>

          {errorMsg && (
            <div
              role="alert"
              className="mb-6 p-3.5 rounded-lg bg-red-50 border border-red-200 text-xs font-medium text-red-700"
            >
              {errorMsg}
            </div>
          )}

          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.18 }}
                className="space-y-6"
              >
                <div>
                  <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
                    Welcome to VidyaOS
                  </h1>
                  <p className="mt-1.5 text-sm text-slate-600">
                    Configure your Indian academic profile once. Your study planner, NCERT quiz engine, and 90/100 score predictor will calibrate to your exact board and schedule.
                  </p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label
                      htmlFor="student-name"
                      className="block text-xs font-semibold text-slate-700 mb-1.5"
                    >
                      Student Full Name
                    </label>
                    <input
                      id="student-name"
                      type="text"
                      value={name}
                      onChange={(e) => {
                        setName(e.target.value);
                        setErrorMsg('');
                      }}
                      placeholder="e.g., Aarav Sharma"
                      className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-transparent"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label
                        htmlFor="student-grade"
                        className="block text-xs font-semibold text-slate-700 mb-1.5"
                      >
                        Class / Grade
                      </label>
                      <select
                        id="student-grade"
                        value={grade}
                        onChange={(e) => setGrade(e.target.value as StudentGrade)}
                        className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-600"
                      >
                        <option value="Class 9">Class 9</option>
                        <option value="Class 10">Class 10 (Board Year)</option>
                        <option value="Class 11">Class 11</option>
                        <option value="Class 12">Class 12 (Board Year)</option>
                        <option value="Competitive / Dropper / College">
                          Competitive / Dropper / College
                        </option>
                      </select>
                    </div>

                    <div>
                      <label
                        htmlFor="student-board"
                        className="block text-xs font-semibold text-slate-700 mb-1.5"
                      >
                        Education Board / Exam Track
                      </label>
                      <select
                        id="student-board"
                        value={board}
                        onChange={(e) => setBoard(e.target.value as IndianBoard)}
                        className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-600"
                      >
                        <option value="CBSE">CBSE (NCERT Curriculum)</option>
                        <option value="ICSE">ICSE / ISC</option>
                        <option value="State Board">State Board (HSC / SSC)</option>
                        <option value="JEE/NEET/CET">JEE / NEET / CET Integrated</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label
                        htmlFor="target-percentage"
                        className="text-xs font-semibold text-slate-700"
                      >
                        Target Board / Exam Score Percentage
                      </label>
                      <span className="text-sm font-bold text-indigo-600 font-mono tabular-nums">
                        {targetPercentage}%
                      </span>
                    </div>
                    <input
                      id="target-percentage"
                      type="range"
                      min={60}
                      max={99}
                      value={targetPercentage}
                      onChange={(e) => setTargetPercentage(Number(e.target.value))}
                      className="w-full accent-indigo-600 cursor-pointer"
                    />
                    <div className="flex justify-between text-xs text-slate-400 font-mono tabular-nums mt-1">
                      <span>60%</span>
                      <span>75% (Distinction)</span>
                      <span>90% (Merit)</span>
                      <span>95%+ (Topper)</span>
                    </div>
                  </div>
                </div>

                <div className="pt-4 flex justify-end">
                  <button
                    type="button"
                    onClick={handleNextStep}
                    className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <span>Continue to Subjects</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.18 }}
                className="space-y-6"
              >
                <div>
                  <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
                    Select Your Curriculum Subjects
                  </h2>
                  <p className="mt-1 text-sm text-slate-600">
                    Choose the exact subjects you are studying in {grade} ({board}) or add custom subjects below.
                  </p>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {SUGGESTED_SUBJECTS_BY_STREAM.map((subj) => {
                    const isSelected = subjects.includes(subj);
                    return (
                      <button
                        key={subj}
                        type="button"
                        onClick={() => toggleSubject(subj)}
                        className={`flex items-center justify-between px-3.5 py-2.5 text-xs font-semibold rounded-lg border text-left transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-indigo-50 border-indigo-600 text-indigo-900'
                            : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                        }`}
                      >
                        <span className="truncate">{subj}</span>
                        {isSelected && (
                          <CheckCircle2 className="w-4 h-4 text-indigo-600 shrink-0 ml-1.5" />
                        )}
                      </button>
                    );
                  })}
                </div>

                <form onSubmit={handleAddCustomSubject} className="flex gap-2">
                  <input
                    type="text"
                    value={customSubject}
                    onChange={(e) => setCustomSubject(e.target.value)}
                    placeholder="Add custom subject (e.g., Applied Mathematics, Sanskrit, Physical Education)"
                    aria-label="Custom Subject Name"
                    className="flex-1 px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-600"
                  />
                  <button
                    type="submit"
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-slate-900 bg-slate-100 border border-slate-300 rounded-lg hover:bg-slate-200 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add Subject</span>
                  </button>
                </form>

                <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
                  <div className="text-xs font-semibold text-slate-700 mb-2">
                    Selected Subjects ({subjects.length})
                  </div>
                  {subjects.length === 0 ? (
                    <p className="text-xs text-slate-500">
                      No subjects selected yet. Click any subject button above to include it in your study plan.
                    </p>
                  ) : (
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-800">
                      {subjects.map((s, idx) => (
                        <React.Fragment key={s}>
                          {idx > 0 && <span aria-hidden="true" className="text-slate-400">·</span>}
                          <span className="font-medium">{s}</span>
                        </React.Fragment>
                      ))}
                    </div>
                  )}
                </div>

                <div className="pt-4 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-slate-700 hover:text-slate-900 cursor-pointer"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    <span>Back</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleNextStep}
                    className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <span>Continue to Timings</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            )}

            {step === 3 && (
              <motion.form
                key="step3"
                onSubmit={handleFinishOnboarding}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.18 }}
                className="space-y-6"
              >
                <div>
                  <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
                    Indian School, Tuition & Sleep Schedule (IST)
                  </h2>
                  <p className="mt-1 text-sm text-slate-600">
                    VidyaOS calculates your true net self-study hours outside School and Coaching classes.
                  </p>
                </div>

                {/* School Schedule */}
                <div className="p-4 rounded-lg border border-slate-200 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                      <GraduationCap className="w-4 h-4 text-indigo-600" />
                      <span>Fixed School / Junior College Timings</span>
                    </h3>
                    <span className="text-xs text-slate-500 font-mono tabular-nums">
                      {schoolStart} – {schoolEnd} IST
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label
                        htmlFor="school-start"
                        className="block text-xs font-medium text-slate-600 mb-1"
                      >
                        School Start Time
                      </label>
                      <input
                        id="school-start"
                        type="time"
                        value={schoolStart}
                        onChange={(e) => setSchoolStart(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono tabular-nums"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="school-end"
                        className="block text-xs font-medium text-slate-600 mb-1"
                      >
                        School End Time
                      </label>
                      <input
                        id="school-end"
                        type="time"
                        value={schoolEnd}
                        onChange={(e) => setSchoolEnd(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono tabular-nums"
                      />
                    </div>
                  </div>

                  <div>
                    <span className="block text-xs font-medium text-slate-600 mb-1.5">
                      Active School Days
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {ALL_DAYS.map((day) => {
                        const active = schoolDays.includes(day);
                        return (
                          <button
                            key={day}
                            type="button"
                            onClick={() => toggleSchoolDay(day)}
                            className={`px-3 py-1.5 text-xs font-semibold rounded-md border transition-colors cursor-pointer ${
                              active
                                ? 'bg-slate-900 text-white border-slate-900'
                                : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                            }`}
                          >
                            {day}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Tuition / Coaching Schedule */}
                <div className="p-4 rounded-lg border border-slate-200 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                      <BookOpen className="w-4 h-4 text-indigo-600" />
                      <span>Tuition / Coaching Batches (Optional)</span>
                    </h3>
                    <span className="text-xs text-slate-500 font-mono tabular-nums">
                      {tuitionBatches.length} batch(es) added
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label
                        htmlFor="tuition-subject"
                        className="block text-xs font-medium text-slate-600 mb-1"
                      >
                        Batch / Subject
                      </label>
                      <select
                        id="tuition-subject"
                        value={newTuitionSubject}
                        onChange={(e) => setNewTuitionSubject(e.target.value)}
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
                      >
                        {subjects.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                        <option value="Combined Coaching Batch">Combined Coaching Batch</option>
                      </select>
                    </div>
                    <div>
                      <label
                        htmlFor="tuition-start"
                        className="block text-xs font-medium text-slate-600 mb-1"
                      >
                        Start Time
                      </label>
                      <input
                        id="tuition-start"
                        type="time"
                        value={newTuitionStart}
                        onChange={(e) => setNewTuitionStart(e.target.value)}
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg font-mono tabular-nums"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="tuition-end"
                        className="block text-xs font-medium text-slate-600 mb-1"
                      >
                        End Time
                      </label>
                      <input
                        id="tuition-end"
                        type="time"
                        value={newTuitionEnd}
                        onChange={(e) => setNewTuitionEnd(e.target.value)}
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg font-mono tabular-nums"
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap gap-1">
                      {ALL_DAYS.map((day) => {
                        const active = newTuitionDays.includes(day);
                        return (
                          <button
                            key={day}
                            type="button"
                            onClick={() => toggleTuitionDay(day)}
                            className={`px-2.5 py-1 text-xs font-medium rounded border cursor-pointer ${
                              active
                                ? 'bg-indigo-600 text-white border-indigo-600'
                                : 'bg-white text-slate-600 border-slate-200'
                            }`}
                          >
                            {day}
                          </button>
                        );
                      })}
                    </div>
                    <button
                      type="button"
                      onClick={handleAddTuitionBatch}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 cursor-pointer whitespace-nowrap shrink-0"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Coaching Slot</span>
                    </button>
                  </div>

                  {tuitionBatches.length > 0 && (
                    <div className="divide-y divide-slate-200 border-t border-slate-200 pt-2">
                      {tuitionBatches.map((b) => (
                        <div
                          key={b.id}
                          className="py-2 flex items-center justify-between text-xs"
                        >
                          <div>
                            <span className="font-semibold text-slate-900">{b.subject}</span>
                            <span aria-hidden="true" className="mx-1.5 text-slate-400">·</span>
                            <span className="font-mono tabular-nums text-slate-600">
                              {b.startTime} – {b.endTime}
                            </span>
                            <span aria-hidden="true" className="mx-1.5 text-slate-400">·</span>
                            <span className="text-slate-500">{b.activeDays.join(', ')}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveTuitionBatch(b.id)}
                            aria-label={`Remove ${b.subject} tuition batch`}
                            className="text-slate-400 hover:text-red-600 p-1 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Sleep & Self-Study Slot */}
                <div className="p-4 rounded-lg border border-slate-200 space-y-4">
                  <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-indigo-600" />
                    <span>Sleep Window & Preferred Self-Study Slot</span>
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label
                        htmlFor="bed-time"
                        className="block text-xs font-medium text-slate-600 mb-1"
                      >
                        Bedtime (IST)
                      </label>
                      <input
                        id="bed-time"
                        type="time"
                        value={bedTime}
                        onChange={(e) => setBedTime(e.target.value)}
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg font-mono tabular-nums"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="wake-time"
                        className="block text-xs font-medium text-slate-600 mb-1"
                      >
                        Wake-Up Time (IST)
                      </label>
                      <input
                        id="wake-time"
                        type="time"
                        value={wakeTime}
                        onChange={(e) => setWakeTime(e.target.value)}
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg font-mono tabular-nums"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="study-slot-pref"
                        className="block text-xs font-medium text-slate-600 mb-1"
                      >
                        Peak Self-Study Focus
                      </label>
                      <select
                        id="study-slot-pref"
                        value={preferredStudySlot}
                        onChange={(e) => setPreferredStudySlot(e.target.value as any)}
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
                      >
                        <option value="Balanced Split (Morning + Evening)">
                          Balanced Split (Morning + Evening)
                        </option>
                        <option value="Morning Peak (5:30 AM – 7:00 AM)">
                          Morning Peak (5:30 AM – 7:00 AM)
                        </option>
                        <option value="Night Focus (8:30 PM – 11:00 PM)">
                          Night Focus (8:30 PM – 11:00 PM)
                        </option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Live Capacity Preview */}
                <div className="p-4 rounded-lg bg-slate-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <div className="text-xs text-slate-400">
                      Calibrated Net Daily Self-Study Capacity
                    </div>
                    <div className="text-sm font-medium mt-0.5">
                      School Day: <strong className="font-mono tabular-nums text-indigo-300">{weekdayCalc.availableHours} hrs/day</strong>
                      <span aria-hidden="true" className="mx-2 text-slate-600">·</span>
                      Sunday / Holiday: <strong className="font-mono tabular-nums text-emerald-300">{sundayCalc.availableHours} hrs/day</strong>
                    </div>
                  </div>
                  <div className="text-xs text-slate-300 font-mono tabular-nums">
                    Sleep: {weekdayCalc.sleepHours}h · School: {weekdayCalc.schoolHours}h
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-slate-700 hover:text-slate-900 cursor-pointer"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    <span>Back</span>
                  </button>
                  <button
                    type="submit"
                    className="inline-flex items-center gap-2 px-6 py-2.5 text-sm font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <span>Launch My VidyaOS Workspace</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </motion.form>
            )}
          </AnimatePresence>
        </div>
      </main>

      <footer className="py-4 px-6 text-center text-xs text-slate-500 border-t border-slate-200 bg-white">
        VidyaOS · Calibrated for CBSE, ICSE, State Boards & Competitive Exams (Asia/Kolkata IST)
      </footer>
    </div>
  );
};
