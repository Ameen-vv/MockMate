import { NextResponse } from 'next/server'

import { askGroq } from '@/lib/groq'
import type { Answer, Difficulty, EvaluationResult, InterviewRole } from '@/types'

const ROLES: InterviewRole[] = [
  'Frontend Developer',
  'Backend Developer',
  'Fullstack Developer',
  'System Design',
  'HR / Behavioural',
]

const DIFFICULTIES: Difficulty[] = ['Junior', 'Mid', 'Senior']

function stripMarkdownFences(raw: string): string {
  let s = raw.trim()
  const fence = /^```(?:json)?\s*\n?([\s\S]*?)\n?```$/im
  const m = s.match(fence)
  if (m) s = m[1].trim()
  return s
}

function isAnswer(value: unknown): value is Answer {
  return (
    value !== null &&
    typeof value === 'object' &&
    typeof (value as Answer).questionId === 'number' &&
    typeof (value as Answer).questionText === 'string' &&
    typeof (value as Answer).answerText === 'string'
  )
}

function isEvaluationResult(
  data: unknown,
  expectedQuestionIds: number[]
): data is EvaluationResult {
  if (data === null || typeof data !== 'object') return false
  const o = data as Record<string, unknown>

  if (typeof o.overallScore !== 'number' || Number.isNaN(o.overallScore)) return false
  if (o.overallScore < 0 || o.overallScore > 10) return false
  if (typeof o.summary !== 'string') return false

  if (!Array.isArray(o.topStrengths) || !Array.isArray(o.areasToImprove)) return false
  if (!o.topStrengths.every((s) => typeof s === 'string')) return false
  if (!o.areasToImprove.every((s) => typeof s === 'string')) return false

  if (!Array.isArray(o.questionFeedback)) return false
  if (o.questionFeedback.length !== expectedQuestionIds.length) return false

  for (let i = 0; i < o.questionFeedback.length; i++) {
    const item = o.questionFeedback[i]
    if (item === null || typeof item !== 'object') return false
    const q = item as Record<string, unknown>
    if (typeof q.questionId !== 'number') return false
    if (q.questionId !== expectedQuestionIds[i]) return false
    if (typeof q.question !== 'string') return false
    if (typeof q.answer !== 'string') return false
    if (typeof q.score !== 'number' || Number.isNaN(q.score)) return false
    if (q.score < 0 || q.score > 10) return false
    if (typeof q.whatWasGood !== 'string') return false
    if (typeof q.whatWasMissing !== 'string') return false
    if (typeof q.idealAnswer !== 'string') return false
  }

  return true
}

function mergeCanonicalQa(
  result: EvaluationResult,
  answers: Answer[]
): EvaluationResult {
  const merged = answers.map((a, i) => ({
    ...result.questionFeedback[i],
    questionId: a.questionId,
    question: a.questionText,
    answer: a.answerText,
  }))
  return { ...result, questionFeedback: merged }
}

function parseEvaluationFromResponse(
  content: string,
  expectedQuestionIds: number[]
): EvaluationResult | null {
  try {
    const stripped = stripMarkdownFences(content)
    const parsed: unknown = JSON.parse(stripped)
    if (!isEvaluationResult(parsed, expectedQuestionIds)) return null
    return parsed
  } catch {
    return null
  }
}

function averageScores(feedback: EvaluationResult['questionFeedback']): number {
  if (feedback.length === 0) return 0
  const sum = feedback.reduce((acc, f) => acc + f.score, 0)
  return Math.round((sum / feedback.length) * 10) / 10
}

function buildPrompt(
  role: InterviewRole,
  difficulty: Difficulty,
  answers: Answer[],
  retryHint: boolean
): string {
  const answersJson = JSON.stringify(answers, null, 2)
  const ids = answers.map((a) => a.questionId).join(', ')
  const retry =
    retryHint &&
    `Your previous response was not valid JSON or did not match the required shape. Output ONLY a raw JSON object — no markdown, no code fences, no commentary.

`
  return `${retry}You are a strict, fair technical interviewer evaluating spoken interview answers.

Context:
- Role: ${role}
- Difficulty: ${difficulty}

Candidate answers (each object is one Q&A from the interview):
${answersJson}

Evaluate EVERY answer. For each item:
- Score from 0–10 (10 = excellent for the stated difficulty).
- whatWasGood: concrete positives.
- whatWasMissing: gaps, inaccuracies, or depth issues.
- idealAnswer: a concise model answer (not longer than ~150 words unless necessary).

Also provide:
- summary: 2–4 sentences on overall performance.
- topStrengths: 3–5 short bullet-style strings.
- areasToImprove: 3–5 short bullet-style strings.

Return ONLY a single valid JSON object (no markdown, no code fences, no text before or after). Shape:

{
  "overallScore": <number, average of the per-question scores, 0–10, one decimal place>,
  "summary": "<string>",
  "questionFeedback": [
    {
      "questionId": <number>,
      "question": "<exact question text from input>",
      "answer": "<exact candidate answer text from input>",
      "score": <number 0–10>,
      "whatWasGood": "<string>",
      "whatWasMissing": "<string>",
      "idealAnswer": "<string>"
    }
  ],
  "topStrengths": ["..."],
  "areasToImprove": ["..."]
}

CRITICAL:
- questionFeedback MUST have exactly ${answers.length} objects, in the same order as the answers array above (questionIds in order: ${ids}).
- For each entry, use the same questionId as the corresponding input row; "question" and "answer" should mirror the input questionText and answerText as closely as possible.
- overallScore MUST equal the arithmetic mean of all "score" values in questionFeedback, rounded to one decimal place.`
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      answers?: unknown
      role?: unknown
      difficulty?: unknown
    }

    const role = body.role
    const difficulty = body.difficulty
    const answers = body.answers

    if (
      typeof role !== 'string' ||
      !ROLES.includes(role as InterviewRole) ||
      typeof difficulty !== 'string' ||
      !DIFFICULTIES.includes(difficulty as Difficulty)
    ) {
      return NextResponse.json(
        { error: 'Invalid role or difficulty' },
        { status: 400 }
      )
    }

    if (!Array.isArray(answers) || answers.length === 0 || !answers.every(isAnswer)) {
      return NextResponse.json(
        { error: 'Invalid or empty answers array' },
        { status: 400 }
      )
    }

    const typedRole = role as InterviewRole
    const typedDifficulty = difficulty as Difficulty
    const typedAnswers = answers as Answer[]
    const expectedQuestionIds = typedAnswers.map((a) => a.questionId)

    let content = await askGroq(
      buildPrompt(typedRole, typedDifficulty, typedAnswers, false)
    )
    let result = parseEvaluationFromResponse(content, expectedQuestionIds)

    if (!result) {
      content = await askGroq(
        buildPrompt(typedRole, typedDifficulty, typedAnswers, true)
      )
      result = parseEvaluationFromResponse(content, expectedQuestionIds)
    }

    if (!result) {
      return NextResponse.json(
        { error: 'Failed to parse evaluation from model response' },
        { status: 502 }
      )
    }

    const merged = mergeCanonicalQa(result, typedAnswers)
    const recomputed = averageScores(merged.questionFeedback)
    const payload: EvaluationResult = {
      ...merged,
      overallScore: recomputed,
    }
    return NextResponse.json(payload)
  } catch (e) {
    console.error('[api/evaluate]', e)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
