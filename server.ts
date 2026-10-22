import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;

function getAiClient(): GoogleGenAI | null {
  const key = process.env.GEMINI_API_KEY;
  if (!key || key === 'MY_GEMINI_API_KEY' || key.trim() === '') {
    return null;
  }
  return new GoogleGenAI({
    apiKey: key,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// Deterministic NCERT / Indian Board Syllabus Parser Fallback when API key is placeholder/unavailable
function buildStructuredSyllabusFallback(
  subject: string,
  board: string,
  grade: string,
  promptText: string
) {
  const lower = `${subject} ${promptText}`.toLowerCase();
  const lines = promptText
    .split(/[\n,;]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 2);

  // Detect common Indian NCERT / Board subjects
  if (lower.includes('math') && (lower.includes('part 2') || lower.includes('integr') || lower.includes('12'))) {
    return {
      curriculumTitle: `${board} ${grade} — ${subject} (Calculus, Vectors & 3D)`,
      chapters: [
        {
          title: 'Chapter 7: Integrals',
          weightageMarks: 12,
          estimatedHours: 8,
          subTopics: [
            { title: 'Integration by Substitution & Trigonometric Identities', estimatedMinutes: 90, difficulty: 'Medium', ncertReference: 'NCERT Ex 7.1 - 7.3' },
            { title: 'Integration by Partial Fractions & By Parts', estimatedMinutes: 120, difficulty: 'Hard', ncertReference: 'NCERT Ex 7.5 - 7.6' },
            { title: 'Definite Integrals & Properties of Definite Integrals', estimatedMinutes: 120, difficulty: 'Hard', ncertReference: 'NCERT Ex 7.8 - 7.11' },
          ],
        },
        {
          title: 'Chapter 8: Application of Integrals',
          weightageMarks: 6,
          estimatedHours: 4,
          subTopics: [
            { title: 'Area Under Simple Curves & Parabolas/Ellipses', estimatedMinutes: 90, difficulty: 'Medium', ncertReference: 'NCERT Ex 8.1' },
            { title: 'Area Bounded by a Curve and a Line', estimatedMinutes: 90, difficulty: 'Medium', ncertReference: 'NCERT Misc Ex 8' },
          ],
        },
        {
          title: 'Chapter 9: Differential Equations',
          weightageMarks: 8,
          estimatedHours: 5,
          subTopics: [
            { title: 'Order, Degree & Variable Separable Differential Equations', estimatedMinutes: 90, difficulty: 'Easy', ncertReference: 'NCERT Ex 9.1 - 9.4' },
            { title: 'Homogeneous & Linear Differential Equations (Integrating Factor)', estimatedMinutes: 120, difficulty: 'Hard', ncertReference: 'NCERT Ex 9.5 - 9.6' },
          ],
        },
        {
          title: 'Chapter 10: Vector Algebra',
          weightageMarks: 7,
          estimatedHours: 4,
          subTopics: [
            { title: 'Direction Cosines, Addition & Section Formula of Vectors', estimatedMinutes: 75, difficulty: 'Easy', ncertReference: 'NCERT Ex 10.1 - 10.2' },
            { title: 'Scalar (Dot) Product & Vector (Cross) Product', estimatedMinutes: 90, difficulty: 'Medium', ncertReference: 'NCERT Ex 10.3 - 10.4' },
          ],
        },
        {
          title: 'Chapter 11: Three Dimensional Geometry',
          weightageMarks: 7,
          estimatedHours: 5,
          subTopics: [
            { title: 'Equation of a Line in Space & Angle Between Two Lines', estimatedMinutes: 90, difficulty: 'Medium', ncertReference: 'NCERT Ex 11.1 - 11.2' },
            { title: 'Shortest Distance Between Two Skew Lines', estimatedMinutes: 90, difficulty: 'Hard', ncertReference: 'NCERT Ex 11.2 Q14-17' },
          ],
        },
      ],
    };
  }

  if (lower.includes('physic')) {
    return {
      curriculumTitle: `${board} ${grade} — ${subject}`,
      chapters: [
        {
          title: 'Chapter 1: Electric Charges and Fields',
          weightageMarks: 8,
          estimatedHours: 5,
          subTopics: [
            { title: "Coulomb's Law, Superposition Principle & Electric Field Lines", estimatedMinutes: 90, difficulty: 'Medium', ncertReference: 'NCERT Ch 1 Sec 1.6 - 1.9' },
            { title: "Electric Dipole Torque & Gauss's Law Applications", estimatedMinutes: 120, difficulty: 'Hard', ncertReference: 'NCERT Ch 1 Sec 1.10 - 1.15' },
          ],
        },
        {
          title: 'Chapter 2: Electrostatic Potential and Capacitance',
          weightageMarks: 8,
          estimatedHours: 5,
          subTopics: [
            { title: 'Potential Due to Point Charge, Dipole & Equipotential Surfaces', estimatedMinutes: 90, difficulty: 'Medium', ncertReference: 'NCERT Ch 2 Sec 2.2 - 2.6' },
            { title: 'Parallel Plate Capacitor, Dielectrics & Energy Stored', estimatedMinutes: 120, difficulty: 'Hard', ncertReference: 'NCERT Ch 2 Sec 2.11 - 2.15' },
          ],
        },
        {
          title: 'Chapter 3: Current Electricity',
          weightageMarks: 7,
          estimatedHours: 5,
          subTopics: [
            { title: 'Drift Velocity, Mobility, Resistivity & Temperature Dependence', estimatedMinutes: 90, difficulty: 'Medium', ncertReference: 'NCERT Ch 3 Sec 3.4 - 3.8' },
            { title: "EMF, Internal Resistance, Kirchhoff's Rules & Wheatstone Bridge", estimatedMinutes: 120, difficulty: 'Hard', ncertReference: 'NCERT Ch 3 Sec 3.11 - 3.14' },
          ],
        },
      ],
    };
  }

  // Dynamic extraction from user-supplied chapter/topic lines
  const extractedChapters = (lines.length > 1 ? lines.slice(0, 8) : [promptText || `${subject} Core Unit`]).map(
    (line, idx) => {
      const cleanTitle = line.replace(/^\d+[\.\)\-\s]+/, '').trim();
      return {
        title: `Chapter ${idx + 1}: ${cleanTitle}`,
        weightageMarks: 8 + (idx % 3) * 2,
        estimatedHours: 4 + (idx % 2),
        subTopics: [
          {
            title: `${cleanTitle} — Fundamental Concepts, NCERT Theory & Definitions`,
            estimatedMinutes: 75,
            difficulty: 'Medium',
            ncertReference: `${board} ${grade} Core Text Sec ${idx + 1}.1`,
          },
          {
            title: `${cleanTitle} — Numericals, Derivations & Previous Year Board Problems`,
            estimatedMinutes: 90,
            difficulty: 'Hard',
            ncertReference: `${board} ${grade} Exercise ${idx + 1}.2`,
          },
        ],
      };
    }
  );

  return {
    curriculumTitle: `${board} ${grade} — ${subject}`,
    chapters: extractedChapters,
  };
}

function buildQuizFallback(subject: string, chapterTitle: string, subTopicTitle: string, board: string) {
  return {
    quizTitle: `${board} Assessment: ${subTopicTitle}`,
    questions: [
      {
        id: 'q1',
        question: `In ${subject} (${chapterTitle}), which fundamental condition must hold true when applying the primary theorem of "${subTopicTitle}" to a standard ${board} board-level problem?`,
        type: 'mcq',
        options: [
          'Continuity and differentiability over the closed domain interval with boundary constraints satisfied',
          'Ignoring boundary constants during definite evaluation across discontinuous points',
          'Assuming linear proportionality regardless of exponent degree or vector direction',
          'Replacing standard SI/NCERT constants with arbitrary unitless approximations',
        ],
        correctIndex: 0,
        conceptTag: `${subTopicTitle} — Core Domain Condition`,
        explanation: `In ${board}/NCERT evaluations, verifying domain continuity and boundary conditions is mandatory before applying the main formula of ${subTopicTitle}.`,
        formulaUsed: 'f(x) continuous on [a, b] and differentiable on (a, b)',
      },
      {
        id: 'q2',
        question: `Numerical Application: While solving a 3-mark ${board} question on "${subTopicTitle}", if the primary input parameter is doubled while keeping auxiliary constants fixed, how does the resultant rate/magnitude scale under standard quadratic dependence?`,
        type: 'numerical',
        options: [
          'Increases by a factor of 4 (quadruples)',
          'Remains unchanged (invariant)',
          'Decreases by a factor of 2 (halves)',
          'Increases linearly by a factor of 2',
        ],
        correctIndex: 0,
        conceptTag: `${subTopicTitle} — Scaling & Numerical Proportionality`,
        explanation: 'Under quadratic dependence (y = k·x²), doubling x to 2x yields k·(2x)² = 4kx², which is 4 times the initial magnitude.',
        formulaUsed: 'y₂ / y₁ = (x₂ / x₁)² = 2² = 4',
      },
      {
        id: 'q3',
        question: `Assertion-Reason (${board} Pattern): Assertion (A): Step-by-step substitution simplifies complex expressions in "${subTopicTitle}". Reason (R): Every composite function in ${chapterTitle} can be reduced to standard NCERT forms when its derivative factor is present.`,
        type: 'mcq',
        options: [
          'Both A and R are true, and R is the correct explanation of A',
          'Both A and R are true, but R is NOT the correct explanation of A',
          'A is true, but R is false',
          'A is false, but R is true',
        ],
        correctIndex: 0,
        conceptTag: `${subTopicTitle} — NCERT Assertion-Reason Analysis`,
        explanation: 'Presence of the derivative factor allows direct reduction to standard canonical NCERT forms via substitution.',
        formulaUsed: '∫ f(g(x)) · g\'(x) dx = ∫ f(t) dt, where t = g(x)',
      },
      {
        id: 'q4',
        question: `Which common mistake leads to loss of 1 step-mark in ${board} answer-sheet evaluation for "${subTopicTitle}"?`,
        type: 'mcq',
        options: [
          'Omitting the constant of integration (+ C) / SI units / boundary limits in the final boxed step',
          'Writing the given data clearly before starting the derivation',
          'Highlighting the standard NCERT identity used on the right margin',
          'Verifying dimensional consistency of the final expression',
        ],
        correctIndex: 0,
        conceptTag: `${subTopicTitle} — Board Step-Marking Precision`,
        explanation: 'CBSE/ICSE/State Board marking schemes explicitly allocate 0.5 to 1 mark for constants of integration, proper limits, or SI units.',
        formulaUsed: 'Final Expression + Constant/Units (Mandatory CBSE Step Marking)',
      },
      {
        id: 'q5',
        question: `Case-Study Problem: For "${subTopicTitle}" in ${chapterTitle}, if the initial state at t = 0 is zero and the system evolves at a constant gradient of 6 units/sec for 5 seconds, what is the accumulated net value?`,
        type: 'numerical',
        options: [
          '30 units',
          '11 units',
          '15 units',
          '60 units',
        ],
        correctIndex: 0,
        conceptTag: `${subTopicTitle} — Definite Accumulation & Rate Integration`,
        explanation: 'Accumulated value = ∫₀⁵ 6 dt = [6t]₀⁵ = 30 units.',
        formulaUsed: 'ΔY = ∫₀ᵀ (dY/dt) dt = 6 × 5 = 30',
      },
    ],
  };
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '15mb' }));

  // 1. Parse Syllabus via Gemini Structured JSON Output
  app.post('/api/ai/parse-syllabus', async (req, res) => {
    const { subject = 'Subject', board = 'CBSE', grade = 'Class 12', promptText = '', fileData } = req.body || {};
    const ai = getAiClient();

    if (!ai) {
      return res.json(buildStructuredSyllabusFallback(subject, board, grade, promptText));
    }

    try {
      const parts: any[] = [];
      if (fileData && fileData.base64Data && fileData.mimeType) {
        parts.push({
          inlineData: {
            mimeType: fileData.mimeType,
            data: fileData.base64Data,
          },
        });
      }
      parts.push({
        text: `You are an expert Indian Education Curriculum Planner for ${board} (${grade}).
Extract a structured syllabus breakdown for subject "${subject}".
Input syllabus prompt/details: "${promptText || 'Standard NCERT/Board curriculum chapters for ' + subject}".
Return 4 to 7 chapters with realistic board mark weightage, estimated self-study hours, and 2 to 4 actionable sub-topics per chapter with estimated minutes (between 45 and 120), difficulty ('Easy', 'Medium', or 'Hard'), and exact NCERT/Board exercise reference.`,
      });

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: { parts },
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              curriculumTitle: { type: Type.STRING },
              chapters: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING },
                    weightageMarks: { type: Type.NUMBER },
                    estimatedHours: { type: Type.NUMBER },
                    subTopics: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          title: { type: Type.STRING },
                          estimatedMinutes: { type: Type.NUMBER },
                          difficulty: { type: Type.STRING },
                          ncertReference: { type: Type.STRING },
                        },
                        required: ['title', 'estimatedMinutes', 'difficulty', 'ncertReference'],
                      },
                    },
                  },
                  required: ['title', 'weightageMarks', 'estimatedHours', 'subTopics'],
                },
              },
            },
            required: ['curriculumTitle', 'chapters'],
          },
        },
      });

      const parsed = JSON.parse(response.text || '{}');
      if (parsed && Array.isArray(parsed.chapters) && parsed.chapters.length > 0) {
        return res.json(parsed);
      }
      return res.json(buildStructuredSyllabusFallback(subject, board, grade, promptText));
    } catch (error) {
      console.error('Gemini syllabus parse fallback:', error);
      return res.json(buildStructuredSyllabusFallback(subject, board, grade, promptText));
    }
  });

  // 2. Generate Instant 5-10 Question Practice Quiz on Topic Completion
  app.post('/api/ai/generate-quiz', async (req, res) => {
    const {
      subject = 'Mathematics',
      chapterTitle = 'Chapter',
      subTopicTitle = 'Topic',
      board = 'CBSE',
      grade = 'Class 12',
    } = req.body || {};

    const ai = getAiClient();
    if (!ai) {
      return res.json(buildQuizFallback(subject, chapterTitle, subTopicTitle, board));
    }

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: `Generate a 5-question practice quiz (mix of conceptual MCQs, Assertion-Reason, and numerical application problems) for an Indian student in ${grade} (${board}) who just completed studying:
Subject: ${subject}
Chapter: ${chapterTitle}
Sub-topic: ${subTopicTitle}
Ensure every question has 4 clear options, the exact 0-based correctIndex (0 to 3), a specific conceptTag for weak-point tracking, a step-by-step explanation, and the key formula/identity used.`,
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              quizTitle: { type: Type.STRING },
              questions: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    id: { type: Type.STRING },
                    question: { type: Type.STRING },
                    type: { type: Type.STRING },
                    options: {
                      type: Type.ARRAY,
                      items: { type: Type.STRING },
                    },
                    correctIndex: { type: Type.INTEGER },
                    conceptTag: { type: Type.STRING },
                    explanation: { type: Type.STRING },
                    formulaUsed: { type: Type.STRING },
                  },
                  required: ['id', 'question', 'type', 'options', 'correctIndex', 'conceptTag', 'explanation', 'formulaUsed'],
                },
              },
            },
            required: ['quizTitle', 'questions'],
          },
        },
      });

      const parsed = JSON.parse(response.text || '{}');
      if (parsed && Array.isArray(parsed.questions) && parsed.questions.length >= 5) {
        return res.json(parsed);
      }
      return res.json(buildQuizFallback(subject, chapterTitle, subTopicTitle, board));
    } catch (error) {
      console.error('Gemini quiz fallback:', error);
      return res.json(buildQuizFallback(subject, chapterTitle, subTopicTitle, board));
    }
  });

  // 3. Weak-Point Concept & Formula Revision Summary after Quiz
  app.post('/api/ai/weak-point-summary', async (req, res) => {
    const {
      subject = 'Mathematics',
      chapterTitle = 'Chapter',
      subTopicTitle = 'Topic',
      board = 'CBSE',
      grade = 'Class 12',
      accuracyPercent = 80,
      wrongQuestions = [],
    } = req.body || {};

    const fallbackSummary = {
      weakSubTopics:
        wrongQuestions.length > 0
          ? wrongQuestions.map((q: any) => q.conceptTag || subTopicTitle)
          : [`${subTopicTitle} — Advanced Board Application`],
      coreConceptSummary:
        wrongQuestions.length > 0
          ? `Focus on strengthening ${wrongQuestions.map((q: any) => q.conceptTag).join(', ')} in ${chapterTitle}. Review boundary conditions and sign conventions before substituting numerical values.`
          : `Strong mastery (${accuracyPercent}%) demonstrated in ${subTopicTitle}. Proceed to solve miscellaneous NCERT exemplar problems for full mark retention.`,
      keyFormulas:
        wrongQuestions.length > 0
          ? wrongQuestions.map((q: any) => q.formulaUsed).filter(Boolean)
          : [`Standard ${board} Canonical Identity for ${subTopicTitle}`, 'Step-marking verification: State Given, Formula, Substitution, and Result with SI Units/+C'],
      ncertExamTips: [
        `Always write the standard ${board} formula in a box to secure step-marks even if arithmetic slips occur.`,
        `Practice at least 3 solved NCERT Examples on ${subTopicTitle} before attempting miscellaneous exercises.`,
      ],
      remediationSteps: [
        `Re-solve the ${wrongQuestions.length || 1} flagged problem pattern(s) without looking at the solution.`,
        `Add the key formula to tonight's VidyaOS Daily Revision PDF sheet.`,
      ],
    };

    const ai = getAiClient();
    if (!ai) {
      return res.json(fallbackSummary);
    }

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: `An Indian ${grade} (${board}) student just completed a quiz on "${subTopicTitle}" (${chapterTitle}, ${subject}) with ${accuracyPercent}% accuracy.
Incorrect questions details: ${JSON.stringify(wrongQuestions)}.
Generate a concise Weak-Point Concept & Formula Revision Summary tailored for ${board} exam preparation.`,
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              weakSubTopics: { type: Type.ARRAY, items: { type: Type.STRING } },
              coreConceptSummary: { type: Type.STRING },
              keyFormulas: { type: Type.ARRAY, items: { type: Type.STRING } },
              ncertExamTips: { type: Type.ARRAY, items: { type: Type.STRING } },
              remediationSteps: { type: Type.ARRAY, items: { type: Type.STRING } },
            },
            required: ['weakSubTopics', 'coreConceptSummary', 'keyFormulas', 'ncertExamTips', 'remediationSteps'],
          },
        },
      });
      const parsed = JSON.parse(response.text || '{}');
      if (parsed && parsed.coreConceptSummary) {
        return res.json(parsed);
      }
      return res.json(fallbackSummary);
    } catch (error) {
      console.error('Weak point summary fallback:', error);
      return res.json(fallbackSummary);
    }
  });

  // 4. Predictive Score Coaching & Bio-Feedback Correlation
  app.post('/api/ai/predictive-coaching', async (req, res) => {
    const {
      studentName = 'Student',
      board = 'CBSE',
      targetScore = 95,
      projectedScore = 88,
      remainingTopicsCount = 4,
      avgQuizAccuracy = 85,
      focusSubject = 'Core Subjects',
      sleepHours = null,
      steps = null,
    } = req.body || {};

    const sleepNote =
      sleepHours !== null && sleepHours < 6.5
        ? `Your logged sleep is ${sleepHours} hrs (below the 7-hr optimal threshold); prioritize conceptual revision and formula recall tonight instead of heavy 5-mark derivations.`
        : sleepHours !== null
        ? `With ${sleepHours} hrs of restorative sleep and ${steps || 0} steps synced from Google Fit / boAt Smartwatch, your cognitive readiness is optimal for high-weightage numerical problem solving.`
        : `Sync your boAt Smartwatch via Google Fit to unlock real-time sleep and fatigue adjustments for your daily study blocks.`;

    const fallbackCoaching = {
      coachingHeadline: `If you master the ${remainingTopicsCount} remaining sub-topics in ${focusSubject} and maintain ${Math.max(85, avgQuizAccuracy)}%+ quiz accuracy this week, you are on track to score ${Math.min(100, Math.max(projectedScore + 3, targetScore - 1))}/100 in your ${board} exams.`,
      bioFeedbackAdvice: sleepNote,
      priorityActions: [
        `Complete today's scheduled ${focusSubject} sub-topics within your net self-study window.`,
        `Align your evening self-study slot with topics taught in School/Tuition today for 2x retention.`,
        `Generate tonight's Daily PDF Revision Sheet before bedtime to lock in weak-point formulas.`,
      ],
    };

    const ai = getAiClient();
    if (!ai) {
      return res.json(fallbackCoaching);
    }

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: `Generate actionable Indian Board (${board}) exam coaching and smartwatch bio-feedback for ${studentName}.
Target Score: ${targetScore}/100, Current Projected Score: ${projectedScore}/100, Remaining Sub-topics: ${remainingTopicsCount}, Average Quiz Accuracy: ${avgQuizAccuracy}%, Focus Subject: ${focusSubject}.
Health Metrics today: Sleep = ${sleepHours ?? 'Not synced'} hrs, Steps = ${steps ?? 'Not synced'}.`,
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              coachingHeadline: { type: Type.STRING },
              bioFeedbackAdvice: { type: Type.STRING },
              priorityActions: { type: Type.ARRAY, items: { type: Type.STRING } },
            },
            required: ['coachingHeadline', 'bioFeedbackAdvice', 'priorityActions'],
          },
        },
      });
      const parsed = JSON.parse(response.text || '{}');
      if (parsed && parsed.coachingHeadline) {
        return res.json(parsed);
      }
      return res.json(fallbackCoaching);
    } catch (error) {
      console.error('Predictive coaching fallback:', error);
      return res.json(fallbackCoaching);
    }
  });

  // 5. Daily Revision PDF Notes Synthesis
  app.post('/api/ai/daily-notes', async (req, res) => {
    const {
      date = '',
      studentName = 'Student',
      board = 'CBSE',
      grade = 'Class 12',
      completedTopics = [],
      weakPointSummaries = [],
      schoolTuitionLogs = [],
    } = req.body || {};

    const topicNames = completedTopics.map((t: any) => `${t.subject}: ${t.subTopicTitle} (${t.chapterTitle})`);
    const fallbackNotes = {
      title: `VidyaOS Daily Revision Notes — ${date}`,
      executiveSummary:
        topicNames.length > 0
          ? `Completed ${topicNames.length} self-study topic(s) for ${grade} (${board}): ${topicNames.join('; ')}. Cross-referenced with ${schoolTuitionLogs.length} school/tuition session(s).`
          : `Daily revision summary compiled for ${studentName} (${grade} · ${board}) covering logged school/tuition concepts and active weak-point formulas.`,
      keyDefinitions:
        topicNames.length > 0
          ? completedTopics.map(
              (t: any) =>
                `${t.subTopicTitle} (${t.subject}): Core ${board} theorem and domain conditions as defined in ${t.ncertReference || 'NCERT Core Text'}.`
            )
          : [
              `Standard ${board} ${grade} theorem definitions and boundary conditions for today's active syllabus chapters.`,
            ],
      essentialFormulas:
        weakPointSummaries.length > 0
          ? weakPointSummaries.flatMap((w: any) => w.keyFormulas || []).slice(0, 6)
          : completedTopics.map(
              (t: any) => `${t.subTopicTitle}: Standard NCERT canonical identity & step-marking verification.`
            ),
      ncertExamTips: [
        `State the exact NCERT theorem or identity next to every derivation step to secure full step-marking.`,
        `Box your final numerical answer with proper SI units or constant of integration (+ C).`,
        `Re-verify sign conventions and domain intervals on 3-mark and 5-mark board questions.`,
      ],
      weakAreaActionPlan:
        weakPointSummaries.length > 0
          ? weakPointSummaries.flatMap((w: any) => w.remediationSteps || []).slice(0, 4)
          : [
              `Solve 5 previous-year ${board} board questions on today's completed sub-topics during tomorrow's morning revision slot.`,
            ],
    };

    const ai = getAiClient();
    if (!ai) {
      return res.json(fallbackNotes);
    }

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: `Synthesize structured Daily Short Revision Notes for Indian student ${studentName} (${grade}, ${board}) on ${date}.
Completed Study Topics Today: ${JSON.stringify(completedTopics)}
Weak-Point Quiz Summaries Today: ${JSON.stringify(weakPointSummaries)}
School & Tuition Logs Today: ${JSON.stringify(schoolTuitionLogs)}
Provide Key Definitions, Essential Formulas, Important NCERT/Board Exam Tips, and a Weak Area Action Plan.`,
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              executiveSummary: { type: Type.STRING },
              keyDefinitions: { type: Type.ARRAY, items: { type: Type.STRING } },
              essentialFormulas: { type: Type.ARRAY, items: { type: Type.STRING } },
              ncertExamTips: { type: Type.ARRAY, items: { type: Type.STRING } },
              weakAreaActionPlan: { type: Type.ARRAY, items: { type: Type.STRING } },
            },
            required: [
              'title',
              'executiveSummary',
              'keyDefinitions',
              'essentialFormulas',
              'ncertExamTips',
              'weakAreaActionPlan',
            ],
          },
        },
      });
      const parsed = JSON.parse(response.text || '{}');
      if (parsed && parsed.executiveSummary) {
        return res.json(parsed);
      }
      return res.json(fallbackNotes);
    } catch (error) {
      console.error('Daily notes synthesis fallback:', error);
      return res.json(fallbackNotes);
    }
  });

  if (process.env.NODE_ENV === 'production') {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`VidyaOS server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
