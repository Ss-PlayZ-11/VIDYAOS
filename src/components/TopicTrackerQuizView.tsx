import React, { useState } from 'react';
import {
  CheckCircle2,
  ClipboardCheck,
  Loader2,
  Sparkles,
  BookOpenCheck,
  AlertTriangle,
  ArrowRight,
} from 'lucide-react';
import type {
  QuizQuestion,
  QuizSubmission,
  ScheduledStudyTask,
  StudentProfile,
  WeakPointSummary,
} from '../types/vidya';
import { evaluateQuizAnswers, formatMathText } from '../utils/studyEngine';

interface TopicTrackerQuizViewProps {
  profile: StudentProfile;
  currentDateStr: string;
  dailyTasks: ScheduledStudyTask[];
  quizHistory: QuizSubmission[];
  weakPointSummaries: WeakPointSummary[];
  onCompleteTopicAndTriggerQuiz: (task: ScheduledStudyTask) => void;
  onSaveQuizResult: (
    submission: QuizSubmission,
    weakPoint: WeakPointSummary
  ) => void;
  activeQuizTask: ScheduledStudyTask | null;
  onClearActiveQuizTask: () => void;
}

export const TopicTrackerQuizView: React.FC<TopicTrackerQuizViewProps> = ({
  profile,
  currentDateStr,
  dailyTasks,
  quizHistory,
  weakPointSummaries,
  onCompleteTopicAndTriggerQuiz,
  onSaveQuizResult,
  activeQuizTask,
  onClearActiveQuizTask,
}) => {
  const [filterMode, setFilterMode] = useState<'today' | 'all' | 'completed'>('today');
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
  const [selectedAnswers, setSelectedAnswers] = useState<number[]>([]);
  const [isLoadingQuiz, setIsLoadingQuiz] = useState<boolean>(false);
  const [isEvaluatingQuiz, setIsEvaluatingQuiz] = useState<boolean>(false);
  const [latestSummary, setLatestSummary] = useState<WeakPointSummary | null>(null);
  const [currentQuizTask, setCurrentQuizTask] = useState<ScheduledStudyTask | null>(
    null
  );

  // Automatically start quiz generation when activeQuizTask is passed from parent
  React.useEffect(() => {
    if (activeQuizTask && activeQuizTask.subTopicId !== currentQuizTask?.subTopicId) {
      startInstantQuizForTask(activeQuizTask);
    }
  }, [activeQuizTask]);

  const startInstantQuizForTask = async (task: ScheduledStudyTask) => {
    setCurrentQuizTask(task);
    setIsLoadingQuiz(true);
    setLatestSummary(null);
    setQuizQuestions([]);
    setSelectedAnswers([]);

    try {
      const res = await fetch('/api/ai/generate-quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: task.subject,
          chapterTitle: task.chapterTitle,
          subTopicTitle: task.subTopicTitle,
          board: profile.board,
          grade: profile.grade,
        }),
      });
      const data = await res.json();
      const questions: QuizQuestion[] = data.questions || [];
      setQuizQuestions(questions);
      setSelectedAnswers(new Array(questions.length).fill(-1));
    } catch (error) {
      console.error('Error generating quiz:', error);
    } finally {
      setIsLoadingQuiz(false);
    }
  };

  const handleCheckboxClick = (task: ScheduledStudyTask) => {
    onCompleteTopicAndTriggerQuiz(task);
    startInstantQuizForTask(task);
  };

  const handleSelectOption = (qIndex: number, optIndex: number) => {
    const next = [...selectedAnswers];
    next[qIndex] = optIndex;
    setSelectedAnswers(next);
  };

  const handleSubmitQuiz = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentQuizTask || quizQuestions.length === 0) return;

    setIsEvaluatingQuiz(true);
    try {
      const evalResult = evaluateQuizAnswers(quizQuestions, selectedAnswers);

      const res = await fetch('/api/ai/weak-point-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: currentQuizTask.subject,
          chapterTitle: currentQuizTask.chapterTitle,
          subTopicTitle: currentQuizTask.subTopicTitle,
          board: profile.board,
          grade: profile.grade,
          accuracyPercent: evalResult.accuracyPercent,
          wrongQuestions: evalResult.wrongQuestions,
        }),
      });

      const summaryData = await res.json();
      const nowId = Date.now();

      const weakPoint: WeakPointSummary = {
        id: `wp-${nowId}`,
        subTopicId: currentQuizTask.subTopicId,
        subject: currentQuizTask.subject,
        chapterTitle: currentQuizTask.chapterTitle,
        subTopicTitle: currentQuizTask.subTopicTitle,
        date: currentDateStr,
        accuracyPercent: evalResult.accuracyPercent,
        weakSubTopics: summaryData.weakSubTopics || [],
        coreConceptSummary:
          summaryData.coreConceptSummary ||
          `Completed ${currentQuizTask.subTopicTitle} with ${evalResult.accuracyPercent}% accuracy.`,
        keyFormulas: summaryData.keyFormulas || [],
        ncertExamTips: summaryData.ncertExamTips || [],
        remediationSteps: summaryData.remediationSteps || [],
      };

      const submission: QuizSubmission = {
        id: `qz-${nowId}`,
        subTopicId: currentQuizTask.subTopicId,
        subject: currentQuizTask.subject,
        chapterTitle: currentQuizTask.chapterTitle,
        subTopicTitle: currentQuizTask.subTopicTitle,
        date: currentDateStr,
        score: evalResult.score,
        total: evalResult.total,
        accuracyPercent: evalResult.accuracyPercent,
        weakPointSummary: weakPoint,
      };

      setLatestSummary(weakPoint);
      onSaveQuizResult(submission, weakPoint);
      onClearActiveQuizTask();
    } catch (error) {
      console.error('Failed to evaluate quiz:', error);
    } finally {
      setIsEvaluatingQuiz(false);
    }
  };

  const todayTasks = dailyTasks.filter(
    (t) => t.scheduledDate <= currentDateStr || !t.completed
  );
  const displayedTasks =
    filterMode === 'today'
      ? todayTasks.slice(0, 8)
      : filterMode === 'completed'
      ? dailyTasks.filter((t) => t.completed)
      : dailyTasks;

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left 6 Cols: Interactive Daily Topic Checklist */}
        <div className="lg:col-span-6 bg-white border border-slate-200 rounded-xl p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200">
            <div>
              <h2 className="text-lg font-bold text-slate-900 tracking-tight">
                Interactive Daily Study Checklist
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Ticking any topic as &ldquo;Done&rdquo; immediately launches an AI Board Practice Quiz
              </p>
            </div>

            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg self-start">
              <button
                type="button"
                onClick={() => setFilterMode('today')}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md cursor-pointer whitespace-nowrap shrink-0 ${
                  filterMode === 'today'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600'
                }`}
              >
                Priority Queue
              </button>
              <button
                type="button"
                onClick={() => setFilterMode('all')}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md cursor-pointer whitespace-nowrap shrink-0 ${
                  filterMode === 'all'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600'
                }`}
              >
                All ({dailyTasks.length})
              </button>
              <button
                type="button"
                onClick={() => setFilterMode('completed')}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md cursor-pointer whitespace-nowrap shrink-0 ${
                  filterMode === 'completed'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600'
                }`}
              >
                Done ({dailyTasks.filter((t) => t.completed).length})
              </button>
            </div>
          </div>

          {displayedTasks.length === 0 ? (
            <div className="py-10 text-center">
              <ClipboardCheck className="w-8 h-8 text-slate-400 mx-auto mb-2.5" />
              <h3 className="text-sm font-semibold text-slate-900">
                No Study Topics in Queue
              </h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                Add your subject syllabus in the Planner tab first so VidyaOS can populate your daily actionable study checklist.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-200">
              {displayedTasks.map((task) => (
                <div
                  key={task.subTopicId}
                  className="py-3.5 flex items-start justify-between gap-3"
                >
                  <div className="flex items-start gap-3">
                    <button
                      type="button"
                      onClick={() => handleCheckboxClick(task)}
                      aria-label={`Mark ${task.subTopicTitle} as Done and start quiz`}
                      className={`mt-0.5 w-5 h-5 rounded border flex items-center justify-center transition-colors cursor-pointer shrink-0 ${
                        task.completed
                          ? 'bg-emerald-600 border-emerald-600 text-white'
                          : 'bg-white border-slate-300 hover:border-indigo-600'
                      }`}
                    >
                      {task.completed && <CheckCircle2 className="w-3.5 h-3.5" />}
                    </button>
                    <div>
                      <div className="text-sm font-semibold text-slate-900">
                        {task.subTopicTitle}
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        <span>{task.subject}</span>
                        <span aria-hidden="true" className="mx-1.5">·</span>
                        <span>{task.chapterTitle}</span>
                        <span aria-hidden="true" className="mx-1.5">·</span>
                        <span className="font-mono tabular-nums">
                          {task.estimatedMinutes} min
                        </span>
                        <span aria-hidden="true" className="mx-1.5">·</span>
                        <span>{task.ncertReference}</span>
                      </div>
                      {task.quizScorePercent !== undefined && (
                        <div className="text-xs font-mono tabular-nums text-emerald-700 font-semibold mt-1">
                          Verified Quiz Score: {task.quizScorePercent}%
                        </div>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleCheckboxClick(task)}
                    className="px-3 py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                  >
                    {task.completed ? 'Retake Quiz' : 'Done + Take Quiz'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right 6 Cols: Instant AI Quiz & Weak-Point Concept Summary */}
        <div className="lg:col-span-6 bg-white border border-slate-200 rounded-xl p-6 space-y-5">
          <div className="flex items-center justify-between pb-4 border-b border-slate-200">
            <div>
              <h2 className="text-lg font-bold text-slate-900 tracking-tight">
                Instant AI Verification Quiz & Weak-Point Analyzer
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {currentQuizTask
                  ? `${currentQuizTask.subject} · ${currentQuizTask.subTopicTitle}`
                  : `Aligned with ${profile.board} (${profile.grade}) marking scheme`}
              </p>
            </div>
            <BookOpenCheck className="w-5 h-5 text-indigo-600 shrink-0" />
          </div>

          {isLoadingQuiz ? (
            <div className="py-14 text-center space-y-3">
              <Loader2 className="w-7 h-7 text-indigo-600 animate-spin mx-auto" />
              <div className="text-sm font-semibold text-slate-900">
                Generating {profile.board}-Aligned Practice Questions...
              </div>
              <p className="text-xs text-slate-500">
                Synthesizing conceptual MCQs & numerical problems for {currentQuizTask?.subTopicTitle}
              </p>
            </div>
          ) : latestSummary ? (
            <div className="space-y-5">
              <div className="p-4 rounded-lg bg-slate-900 text-white flex items-center justify-between">
                <div>
                  <div className="text-xs text-slate-400">
                    Quiz Verification Complete · {latestSummary.subject}
                  </div>
                  <div className="text-base font-bold mt-0.5">
                    {latestSummary.subTopicTitle}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-slate-400">Accuracy</div>
                  <div className="text-2xl font-bold font-mono tabular-nums text-emerald-400">
                    {latestSummary.accuracyPercent}%
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-xs font-bold text-slate-900 mb-1.5 flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  <span>Weak-Point Concept & Formula Revision Summary</span>
                </h3>
                <p className="text-xs text-slate-700 leading-relaxed">
                  {latestSummary.coreConceptSummary}
                </p>
              </div>

              <div className="space-y-2">
                <div className="text-xs font-semibold text-slate-900">
                  Key Formulas & Identities to Revise:
                </div>
                <ul className="space-y-1.5">
                  {latestSummary.keyFormulas.map((formula, idx) => (
                    <li
                      key={idx}
                      className="text-xs font-mono bg-slate-50 rounded-md px-3 py-2 text-slate-800"
                    >
                      {formatMathText(formula)}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="space-y-2">
                <div className="text-xs font-semibold text-slate-900">
                  {profile.board} / NCERT Step-Marking Tips:
                </div>
                <ul className="space-y-1 text-xs text-slate-600">
                  {latestSummary.ncertExamTips.map((tip, idx) => (
                    <li key={idx}>• {formatMathText(tip)}</li>
                  ))}
                </ul>
              </div>
            </div>
          ) : quizQuestions.length > 0 && currentQuizTask ? (
            <form onSubmit={handleSubmitQuiz} className="space-y-5">
              <div className="space-y-5 max-h-[460px] overflow-y-auto pr-1 divide-y divide-slate-200">
                {quizQuestions.map((q, qIdx) => (
                  <div
                    key={q.id}
                    className="pt-4 first:pt-0 space-y-3"
                  >
                    <div className="text-xs font-mono tabular-nums text-slate-500">
                      Question {qIdx + 1} of {quizQuestions.length} · {q.type.toUpperCase()} · {q.conceptTag}
                    </div>
                    <div className="text-sm font-semibold text-slate-900">
                      {formatMathText(q.question)}
                    </div>
                    <div className="space-y-2">
                      {q.options.map((opt, optIdx) => {
                        const chosen = selectedAnswers[qIdx] === optIdx;
                        return (
                          <button
                            key={optIdx}
                            type="button"
                            onClick={() => handleSelectOption(qIdx, optIdx)}
                            className={`w-full text-left px-3.5 py-2.5 rounded-lg border text-xs font-medium transition-colors cursor-pointer ${
                              chosen
                                ? 'bg-indigo-50 border-indigo-600 text-indigo-950 font-semibold'
                                : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                            }`}
                          >
                            <span className="font-mono mr-2">
                              {String.fromCharCode(65 + optIdx)}.
                            </span>
                            <span>{formatMathText(opt)}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              <div className="pt-2 flex items-center justify-between border-t border-slate-200">
                <span className="text-xs text-slate-500 font-mono tabular-nums">
                  Answered: {selectedAnswers.filter((a) => a !== -1).length} / {quizQuestions.length}
                </span>
                <button
                  type="submit"
                  disabled={isEvaluatingQuiz}
                  className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-60 cursor-pointer whitespace-nowrap shrink-0"
                >
                  {isEvaluatingQuiz ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Analyzing Weak Points...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>Submit Quiz & Generate Weak-Point Summary</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </form>
          ) : (
            <div className="py-12 text-center">
              <Sparkles className="w-8 h-8 text-slate-400 mx-auto mb-2.5" />
              <h3 className="text-sm font-semibold text-slate-900">
                Tick Any Study Topic as &ldquo;Done&rdquo; to Start Quiz
              </h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                As soon as you complete a scheduled sub-topic on the left, Gemini generates a targeted 5-to-10 question NCERT/Board quiz and weak-point revision sheet here.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Stored Weak-Point Revision Vault */}
      {weakPointSummaries.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900">
              Saved Weak-Point Concept & Formula Summaries ({weakPointSummaries.length})
            </h2>
            <span className="text-xs text-slate-500">
              Automatically included in tonight&apos;s Daily PDF Revision Sheet
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {weakPointSummaries.map((wp) => (
              <div
                key={wp.id}
                className="p-4 rounded-lg border border-slate-200 space-y-2"
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-900">
                    {wp.subject} · {wp.subTopicTitle}
                  </span>
                  <span className="font-mono tabular-nums font-semibold text-indigo-600">
                    Quiz: {wp.accuracyPercent}%
                  </span>
                </div>
                <p className="text-xs text-slate-600">{wp.coreConceptSummary}</p>
                {wp.keyFormulas.length > 0 && (
                  <div className="text-xs font-mono text-slate-800 bg-slate-50 px-2.5 py-1.5 rounded border border-slate-200">
                    {wp.keyFormulas[0]}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
