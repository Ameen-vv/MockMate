import { NextResponse } from 'next/server'

import { askGroq } from '@/lib/groq'
import type { Difficulty, InterviewRole, Question } from '@/types'

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

function isQuestionArray(data: unknown): data is Question[] {
  if (!Array.isArray(data) || data.length !== 7) return false
  const ids = new Set<number>()
  for (const item of data) {
    if (
      item === null ||
      typeof item !== 'object' ||
      typeof (item as Question).id !== 'number' ||
      typeof (item as Question).text !== 'string' ||
      (item as Question).text.trim().length === 0
    ) {
      return false
    }
    const id = (item as Question).id
    if (id < 1 || id > 7 || ids.has(id)) return false
    ids.add(id)
  }
  return ids.size === 7
}

function parseQuestionsFromResponse(content: string): Question[] | null {
  try {
    const stripped = stripMarkdownFences(content)
    const parsed: unknown = JSON.parse(stripped)
    if (!isQuestionArray(parsed)) return null
    return parsed
  } catch {
    return null
  }
}

function buildPrompt(role: InterviewRole, difficulty: Difficulty, retryHint: boolean): string {
  const retry =
    retryHint &&
    `Your previous response was not valid JSON. Output ONLY a raw JSON array — no markdown, no code fences, no commentary.

`
  return `${retry}You are an expert technical interviewer.

Generate exactly 7 interview questions for a candidate interviewing for: "${role}".
Difficulty level: ${difficulty}.

Requirements:
- Questions must be appropriate for the role and difficulty (depth, scope, and terminology).
- Each question must be clear and answerable in a short spoken interview answer (1–3 minutes).
- Return ONLY a valid JSON array of exactly 7 objects. No markdown, no code fences, no text before or after the JSON.

Each object must have this shape:
{ "id": number (1 through 7), "text": string }

Example format (structure only, do not copy these questions):
[{"id":1,"text":"..."},{"id":2,"text":"..."},...]`
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      role?: unknown
      difficulty?: unknown
    }

    const role = body.role
    const difficulty = body.difficulty

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

    const typedRole = role as InterviewRole
    const typedDifficulty = difficulty as Difficulty

    let content = await askGroq(buildPrompt(typedRole, typedDifficulty, false))
    let questions = parseQuestionsFromResponse(content)

    if (!questions) {
      content = await askGroq(buildPrompt(typedRole, typedDifficulty, true))
      questions = parseQuestionsFromResponse(content)
    }

    if (!questions) {
      return NextResponse.json(
        { error: 'Failed to parse questions from model response' },
        { status: 502 }
      )
    }

    questions.sort((a, b) => a.id - b.id)
    return NextResponse.json({ questions })
  } catch (e) {
    console.error('[api/questions]', e)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
