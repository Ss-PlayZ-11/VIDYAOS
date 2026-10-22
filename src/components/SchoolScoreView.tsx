import React, { useState } from 'react';
import {
  Award,
  Building2,
  CheckCircle2,
  Loader2,
  Plus,
  Sparkles,
  Trash2,
} from 'lucide-react';
import type {
  HealthMetrics,
  QuizSubmission,
  SchoolTuitionLog,
  StudentProfile,
  SyllabusPlan,
} from '../types/vidya';
import {
  calculateOverallProjectedScore,
  calculateSubjectProjectedScore,
} from '../utils/studyEngine';

interface SchoolScoreViewProps {
  profile: StudentProfile;
  currentDateStr: string;
  syllabi: SyllabusPlan[];
  quizHistory: QuizSubmission[];
  schoolTuitionLogs: SchoolTuitionLog[];
  latestHealth: HealthMetrics | null;
  onAddSchoolTuitionLog: (log: SchoolTuitionLog) => void;
  onToggleLogRevision: (logId: string) => void;
  onDeleteLog: (logId: string) => void;
}

export const SchoolScoreView: React.FC<SchoolScoreViewProps> = ({
  profile,
  currentDateStr,
  syllabi,
  quizHistory,
  schoolTuitionLogs,
  latestHealth,
  onAddSchoolTuitionLog,
  onToggleLogRevision,
  onDeleteLog,
}) => {
  const [source, setSource] = useState<'School' | 'Tuition'>('School');
  const [subject, setSubject] = useState<string>(
    profile.subjects[0] || 'Mathematics'
  );
  const [chapterTaught, setChapterTaught] = useState<string>('');
  const [topicTaught, setTopicTaught] = useState<string>('');
  const [logError, setLogError] = useState<string>('');

  const [coachingAdvice, setCoachingAdvice] = useState<{
    coachingHeadline: string;
    bioFeedbackAdvice: string;
    priorityActions: string[];
  } | null>(null);
  const [isLoadingCoaching, setIsLoadingCoaching] = useState<boolean>(false);

  // Compute subject projected scores
  const subjectMetrics = profile.subjects.map((subj) =>
    calculateSubjectProjectedScore(
      subj,
      profile,
      syllabi,
      quizHistory,
      schoolTuitionLogs,
      currentDateStr
    )
  );
  const overallProjected = calculateOverallProjectedScore(subjectMetrics);

  // Automatic cross-reference matching with student's self-study sub-topics
  const findMatchingSubTopic = (
    subj: string,
    chapText: string,
    topText: string
  ) => {
    const query = `${chapText} ${topText}`.toLowerCase();
    const words = query
      .split(/\s+/)
      .map((w) => w.replace(/[^a-z0-9]/g, ''))
      .filter((w) => w.length > 3);

    const plans = syllabi.filter(
      (p) => p.subject.toLowerCase() === subj.toLowerCase()
    );
    for (const plan of plans) {
      for (const ch of plan.chapters) {
        for (const st of ch.subTopics) {
          const hay = `${ch.title} ${st.title}`.toLowerCase();
          if (words.some((w) => hay.includes(w))) {
            return st;
          }
        }
      }
    }
    return undefined;
  };

  const handleLogSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLogError('');
    if (!chapterTaught.trim() || !topicTaught.trim()) {
      setLogError(
        'Please enter both the chapter name and specific topic taught today in School or Tuition.'
      );
      return;
    }

    const matched = findMatchingSubTopic(subject, chapterTaught, topicTaught);

    const newLog: SchoolTuitionLog = {
      id: `stlog-${Date.now()}`,
      date: currentDateStr,
      source,
      subject,
      chapterTaught: chapterTaught.trim(),
      topicTaught: topicTaught.trim(),
      alignedSubTopicId: matched?.id,
      alignedSubTopicTitle: matched?.title,
      revisionCompleted: Boolean(matched?.completed),
    };

    onAddSchoolTuitionLog(newLog);
    setChapterTaught('');
    setTopicTaught('');
  };

  const handleGenerateCoaching = async () => {
    setIsLoadingCoaching(true);
    try {
      const activeSubj =
        subjectMetrics.find((m) => m.projectedScore > 0) || subjectMetrics[0];
      const totalRemaining = subjectMetrics.reduce(
        (acc, m) => acc + m.remainingSubTopics,
        0
      );
      const avgQuiz =
        quizHistory.length > 0
          ? Math.round(
              quizHistory.reduce((a, q) => a + q.accuracyPercent, 0) /
                quizHistory.length
            )
          : 85;

      const res = await fetch('/api/ai/predictive-coaching', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentName: profile.name,
          board: profile.board,
          targetScore: profile.targetPercentage,
          projectedScore: overallProjected || profile.targetPercentage - 4,
          remainingTopicsCount: totalRemaining || 3,
          avgQuizAccuracy: avgQuiz,
          focusSubject: activeSubj?.subject || profile.subjects[0] || 'Calculus',
          sleepHours: latestHealth?.sleepHours ?? null,
          steps: latestHealth?.steps ?? null,
        }),
      });
      const data = await res.json();
      setCoachingAdvice(data);
    } catch (error) {
      console.error('Failed to fetch predictive coaching:', error);
    } finally {
      setIsLoadingCoaching(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Top Row: AI Predictive Score & Readiness Engine ("90/100 Grader") */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-200">
          <div>
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">
              AI Predictive Exam Score Engine (&ldquo;90/100 Grader&rdquo;)
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Calculated from (a) Syllabus completion pace vs. deadline · (b) Post-topic Quiz accuracy · (c) School/Tuition revision overlap
            </p>
          </div>

          <button
            type="button"
            onClick={handleGenerateCoaching}
            disabled={isLoadingCoaching}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-60 transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            {isLoadingCoaching ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Calculating Forecast...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>Refresh AI Score Coaching</span>
              </>
            )}
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          {/* Overall Gauge */}
          <div className="lg:col-span-4 p-5 rounded-xl bg-slate-900 text-white flex flex-col justify-between">
            <div>
              <div className="text-xs text-slate-400">
                Overall Projected {profile.board} Score
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-4xl font-bold font-mono tabular-nums text-white">
                  {overallProjected > 0 ? `${overallProjected} / 100` : '— / 100'}
                </span>
              </div>
              <div className="mt-1 text-xs text-slate-300 font-mono tabular-nums">
                Target Goal: {profile.targetPercentage} / 100
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-800 text-xs text-slate-300">
              {overallProjected === 0
                ? 'Add a subject syllabus or log your first topic quiz/school session to activate live score prediction.'
                : overallProjected >= profile.targetPercentage
                ? 'On Track: Your current completion pace and quiz accuracy meet your target percentile.'
                : `Gap to Target: +${profile.targetPercentage - overallProjected} marks needed via pending sub-topic mastery.`}
            </div>
          </div>

          {/* Subject-by-Subject Score Table */}
          <div className="lg:col-span-8 overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-xs font-semibold text-slate-500">
                  <th className="py-2.5 pr-4">Subject</th>
                  <th className="py-2.5 px-3 text-right">Syllabus Pace</th>
                  <th className="py-2.5 px-3 text-right">Quiz Accuracy</th>
                  <th className="py-2.5 px-3 text-right">Tuition/School Sync</th>
                  <th className="py-2.5 pl-4 text-right">Projected Score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-xs">
                {subjectMetrics.map((m) => (
                  <tr key={m.subject} className="hover:bg-slate-50">
                    <td className="py-3 pr-4 font-semibold text-slate-900">
                      {m.subject}
                    </td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-600">
                      {m.totalSubTopics > 0
                        ? `${m.completionPercent}% (${m.totalSubTopics - m.remainingSubTopics}/${m.totalSubTopics})`
                        : 'No syllabus'}
                    </td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-600">
                      {m.quizAccuracy > 0 ? `${m.quizAccuracy}%` : '—'}
                    </td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-600">
                      {m.revisionOverlapPercent > 0
                        ? `${m.revisionOverlapPercent}%`
                        : '—'}
                    </td>
                    <td className="py-3 pl-4 text-right font-mono tabular-nums font-bold text-indigo-600">
                      {m.projectedScore > 0 ? `${m.projectedScore} / 100` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* AI Coaching Guidance Box */}
        {coachingAdvice && (
          <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-2.5">
            <div className="flex items-center gap-2 text-xs font-bold text-indigo-700">
              <Award className="w-4 h-4" />
              <span>Gemini Exam Readiness Coaching</span>
            </div>
            <p className="text-sm font-semibold text-slate-900">
              &ldquo;{coachingAdvice.coachingHeadline}&rdquo;
            </p>
            <p className="text-xs text-slate-600">
              {coachingAdvice.bioFeedbackAdvice}
            </p>
          </div>
        )}
      </div>

      {/* Bottom Split: Daily School & Tuition Log + Cross-Reference Alignment */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Log Today&apos;s School & Tuition Topics
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Cross-references classroom topics with your self-study syllabus
              </p>
            </div>
            <Building2 className="w-5 h-5 text-indigo-600 shrink-0" />
          </div>

          {logError && (
            <div
              role="alert"
              className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs font-medium text-red-700"
            >
              {logError}
            </div>
          )}

          <form onSubmit={handleLogSubmit} className="space-y-3.5">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="log-source"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Session Type
                </label>
                <select
                  id="log-source"
                  value={source}
                  onChange={(e) => setSource(e.target.value as 'School' | 'Tuition')}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
                >
                  <option value="School">School / Junior College</option>
                  <option value="Tuition">Tuition / Coaching Batch</option>
                </select>
              </div>
              <div>
                <label
                  htmlFor="log-subject"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Subject
                </label>
                <select
                  id="log-subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
                >
                  {profile.subjects.map((subj) => (
                    <option key={subj} value={subj}>
                      {subj}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label
                htmlFor="log-chapter"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Chapter Taught Today
              </label>
              <input
                id="log-chapter"
                type="text"
                value={chapterTaught}
                onChange={(e) => {
                  setChapterTaught(e.target.value);
                  setLogError('');
                }}
                placeholder="e.g., Chapter 7: Integrals"
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
              />
            </div>

            <div>
              <label
                htmlFor="log-topic"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Specific Concept / Exercise Covered
              </label>
              <input
                id="log-topic"
                type="text"
                value={topicTaught}
                onChange={(e) => {
                  setTopicTaught(e.target.value);
                  setLogError('');
                }}
                placeholder="e.g., Integration by Partial Fractions (Ex 7.5)"
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
              />
            </div>

            <button
              type="submit"
              className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Log Classroom Session & Cross-Reference</span>
            </button>
          </form>
        </div>

        {/* Right 7 Cols: Logged School & Tuition Entries with Alignment Status */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                School & Tuition Alignment Tracker ({schoolTuitionLogs.length})
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Highlights overlap between classroom teaching and your self-study syllabus
              </p>
            </div>
          </div>

          {schoolTuitionLogs.length === 0 ? (
            <div className="py-10 text-center">
              <Building2 className="w-8 h-8 text-slate-400 mx-auto mb-2" />
              <h3 className="text-sm font-semibold text-slate-900">
                No School or Tuition Sessions Logged Yet
              </h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                Log what was taught in School or Coaching today on the left to track revision overlap and boost your 90/100 Readiness Score.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-200">
              {schoolTuitionLogs.map((log) => (
                <div
                  key={log.id}
                  className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="space-y-1">
                    <div className="text-sm font-semibold text-slate-900">
                      {log.topicTaught}
                    </div>
                    <div className="text-xs text-slate-500">
                      <span className="font-semibold text-slate-700">
                        {log.source}
                      </span>
                      <span aria-hidden="true" className="mx-1.5">·</span>
                      <span>{log.subject}</span>
                      <span aria-hidden="true" className="mx-1.5">·</span>
                      <span>{log.chapterTaught}</span>
                      <span aria-hidden="true" className="mx-1.5">·</span>
                      <span className="font-mono tabular-nums">{log.date}</span>
                    </div>
                    <div className="text-xs text-slate-600">
                      {log.alignedSubTopicTitle ? (
                        <span className="text-emerald-700 font-medium">
                          Aligned with Syllabus Sub-topic: {log.alignedSubTopicTitle}
                        </span>
                      ) : (
                        <span className="text-amber-700 font-medium">
                          Pending Self-Study Revision Alignment
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => onToggleLogRevision(log.id)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                        log.revisionCompleted
                          ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                          : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>
                        {log.revisionCompleted ? 'Revised at Home' : 'Mark Revised'}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteLog(log.id)}
                      aria-label={`Delete ${log.topicTaught} log`}
                      className="p-1.5 text-slate-400 hover:text-red-600 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
