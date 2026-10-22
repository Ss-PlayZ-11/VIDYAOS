import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addDaysToDateString,
  calculateDailyAvailableStudyHours,
  calculateOverallProjectedScore,
  calculateSubjectProjectedScore,
  computeBioFeedbackCorrelation,
  evaluateQuizAnswers,
  generateStudySchedule,
  parseTimeToMinutes,
} from './studyEngine';
import type {
  HolidayDate,
  QuizQuestion,
  StudentProfile,
  SyllabusPlan,
} from '../types/vidya';

const sampleProfile: StudentProfile = {
  name: 'Aarav Sharma',
  grade: 'Class 12',
  board: 'CBSE',
  targetPercentage: 95,
  subjects: ['Mathematics Part 2', 'Physics'],
  schoolSchedule: {
    startTime: '07:30',
    endTime: '14:00',
    activeDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  },
  tuitionBatches: [
    {
      id: 't1',
      subject: 'Mathematics Part 2',
      startTime: '16:30',
      endTime: '19:30',
      activeDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    },
  ],
  sleepWindow: {
    bedTime: '23:00',
    wakeTime: '06:00',
    preferredStudySlot: 'Night Focus (8:30 PM – 11:00 PM)',
  },
  notificationsEnabled: false,
  onboardedAt: '2026-10-21T10:00:00.000Z',
};

test('parseTimeToMinutes converts HH:MM accurately', () => {
  assert.equal(parseTimeToMinutes('07:30'), 450);
  assert.equal(parseTimeToMinutes('14:00'), 840);
});

test('calculateDailyAvailableStudyHours reclaims school and tuition hours on a marked holiday', () => {
  // 2026-10-22 is a Thursday (regular school + tuition day)
  const regularDay = calculateDailyAvailableStudyHours(sampleProfile, '2026-10-22', []);
  assert.equal(regularDay.isHoliday, false);
  assert.equal(regularDay.schoolHours, 6.5);
  assert.equal(regularDay.tuitionHours, 3);
  assert.equal(regularDay.availableHours, 4);

  // Mark 2026-10-22 as Diwali Holiday (no school, no tuition)
  const holidays: HolidayDate[] = [
    {
      date: '2026-10-22',
      label: 'Diwali Festival Study Day',
      noSchool: true,
      noTuition: true,
    },
  ];
  const holidayCalc = calculateDailyAvailableStudyHours(sampleProfile, '2026-10-22', holidays);
  assert.equal(holidayCalc.isHoliday, true);
  assert.equal(holidayCalc.schoolHours, 0);
  assert.equal(holidayCalc.tuitionHours, 0);
  assert.ok(holidayCalc.availableHours >= 9, 'Holiday should provide at least 9 hours of self-study time');
});

test('generateStudySchedule distributes chapters and rebalances faster when a holiday is toggled', () => {
  const sampleSyllabus: SyllabusPlan = {
    id: 'syl-1',
    subject: 'Mathematics Part 2',
    curriculumTitle: 'NCERT Class 12 Maths Part 2',
    deadlineDate: '2026-11-30',
    createdAt: '2026-10-21',
    chapters: [
      {
        id: 'ch-7',
        subject: 'Mathematics Part 2',
        title: 'Chapter 7: Integrals',
        weightageMarks: 12,
        estimatedHours: 6,
        subTopics: [
          {
            id: 'st-1',
            chapterId: 'ch-7',
            chapterTitle: 'Chapter 7: Integrals',
            subject: 'Mathematics Part 2',
            title: 'Integration by Substitution',
            estimatedMinutes: 120,
            difficulty: 'Medium',
            ncertReference: 'Ex 7.2',
            completed: false,
          },
          {
            id: 'st-2',
            chapterId: 'ch-7',
            chapterTitle: 'Chapter 7: Integrals',
            subject: 'Mathematics Part 2',
            title: 'Integration by Partial Fractions',
            estimatedMinutes: 120,
            difficulty: 'Hard',
            ncertReference: 'Ex 7.5',
            completed: false,
          },
          {
            id: 'st-3',
            chapterId: 'ch-7',
            chapterTitle: 'Chapter 7: Integrals',
            subject: 'Mathematics Part 2',
            title: 'Definite Integrals Properties',
            estimatedMinutes: 150,
            difficulty: 'Hard',
            ncertReference: 'Ex 7.11',
            completed: false,
          },
        ],
      },
    ],
  };

  // Without holiday on 2026-10-22 (only 240 mins available), st-3 (total 390 mins) spills to 2026-10-23
  const normalSchedule = generateStudySchedule([sampleSyllabus], sampleProfile, [], '2026-10-22');
  assert.equal(normalSchedule.dailyTasks.length, 3);
  assert.equal(normalSchedule.dailyTasks[0].scheduledDate, '2026-10-22');
  assert.equal(normalSchedule.dailyTasks[1].scheduledDate, '2026-10-22');
  assert.equal(normalSchedule.dailyTasks[2].scheduledDate, addDaysToDateString('2026-10-22', 1));

  // With holiday on 2026-10-22 (570 mins available), all 3 sub-topics fit on 2026-10-22!
  const holidaySchedule = generateStudySchedule(
    [sampleSyllabus],
    sampleProfile,
    [{ date: '2026-10-22', label: 'No-School Day', noSchool: true, noTuition: true }],
    '2026-10-22'
  );
  assert.equal(holidaySchedule.dailyTasks[2].scheduledDate, '2026-10-22');
});

test('evaluateQuizAnswers computes accuracy and extracts wrong questions', () => {
  const questions: QuizQuestion[] = [
    {
      id: 'q1',
      question: '∫ cos(x) dx = ?',
      type: 'mcq',
      options: ['sin(x) + C', '-sin(x) + C', 'tan(x) + C', 'sec(x) + C'],
      correctIndex: 0,
      conceptTag: 'Standard Trigonometric Integrals',
      explanation: 'Derivative of sin(x) is cos(x)',
      formulaUsed: '∫ cos(x) dx = sin(x) + C',
    },
    {
      id: 'q2',
      question: 'Order of d²y/dx² + (dy/dx)³ = 0 is?',
      type: 'numerical',
      options: ['2', '3', '1', '0'],
      correctIndex: 0,
      conceptTag: 'Order of Differential Equations',
      explanation: 'Highest order derivative is 2',
      formulaUsed: 'Order = highest derivative order',
    },
  ];

  const result = evaluateQuizAnswers(questions, [0, 1]);
  assert.equal(result.score, 1);
  assert.equal(result.total, 2);
  assert.equal(result.accuracyPercent, 50);
  assert.equal(result.wrongQuestions.length, 1);
  assert.equal(result.wrongQuestions[0].conceptTag, 'Order of Differential Equations');
});

test('calculateSubjectProjectedScore returns 0 when no data exists and computes 90/100 score when populated', () => {
  const emptyMetric = calculateSubjectProjectedScore(
    'Mathematics Part 2',
    sampleProfile,
    [],
    [],
    [],
    '2026-10-22'
  );
  assert.equal(emptyMetric.projectedScore, 0);

  const populatedSyllabus: SyllabusPlan = {
    id: 'syl-1',
    subject: 'Mathematics Part 2',
    curriculumTitle: 'NCERT Class 12 Maths Part 2',
    deadlineDate: '2026-11-30',
    createdAt: '2026-10-21',
    chapters: [
      {
        id: 'ch-7',
        subject: 'Mathematics Part 2',
        title: 'Chapter 7: Integrals',
        weightageMarks: 12,
        estimatedHours: 4,
        subTopics: [
          {
            id: 'st-1',
            chapterId: 'ch-7',
            chapterTitle: 'Chapter 7: Integrals',
            subject: 'Mathematics Part 2',
            title: 'Integration by Substitution',
            estimatedMinutes: 90,
            difficulty: 'Medium',
            ncertReference: 'Ex 7.2',
            completed: true,
            quizScorePercent: 90,
          },
        ],
      },
    ],
  };

  const activeMetric = calculateSubjectProjectedScore(
    'Mathematics Part 2',
    sampleProfile,
    [populatedSyllabus],
    [
      {
        id: 'qz-1',
        subTopicId: 'st-1',
        subject: 'Mathematics Part 2',
        chapterTitle: 'Chapter 7: Integrals',
        subTopicTitle: 'Integration by Substitution',
        date: '2026-10-22',
        score: 9,
        total: 10,
        accuracyPercent: 90,
      },
    ],
    [
      {
        id: 'log-1',
        date: '2026-10-22',
        source: 'Tuition',
        subject: 'Mathematics Part 2',
        chapterTaught: 'Chapter 7: Integrals',
        topicTaught: 'Integration by Substitution',
        alignedSubTopicId: 'st-1',
        revisionCompleted: true,
      },
    ],
    '2026-10-22'
  );

  assert.ok(activeMetric.projectedScore >= 90);
  assert.equal(calculateOverallProjectedScore([activeMetric]), activeMetric.projectedScore);
});

test('computeBioFeedbackCorrelation adapts study block duration to sleep and heart rate', () => {
  const lowSleep = computeBioFeedbackCorrelation({
    date: '2026-10-22',
    steps: 4200,
    heartRateBpm: 82,
    caloriesBurned: 1650,
    sleepHours: 5.2,
    syncedFrom: 'Google Fit (boAt Smartwatch Sync)',
    syncedAt: '2026-10-22T07:00:00Z',
  });
  assert.equal(lowSleep.statusLabel, 'RECOVERY NEEDED');
  assert.equal(lowSleep.recommendedBlockMinutes, 40);

  const optimal = computeBioFeedbackCorrelation({
    date: '2026-10-22',
    steps: 8500,
    heartRateBpm: 68,
    caloriesBurned: 2100,
    sleepHours: 7.8,
    syncedFrom: 'Google Fit (boAt Smartwatch Sync)',
    syncedAt: '2026-10-22T07:00:00Z',
  });
  assert.equal(optimal.statusLabel, 'OPTIMAL READINESS');
  assert.equal(optimal.recommendedBlockMinutes, 90);
});

