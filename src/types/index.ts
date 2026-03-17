export type InterviewRole =
  | 'Frontend Developer'
  | 'Backend Developer'
  | 'Fullstack Developer'
  | 'System Design'
  | 'HR / Behavioural'

export type Difficulty = 'Junior' | 'Mid' | 'Senior'

export type Question = {
  id: number
  text: string
}

export type Answer = {
  questionId: number
  questionText: string
  answerText: string
}

export type QuestionFeedback = {
  questionId: number
  question: string
  answer: string
  score: number
  whatWasGood: string
  whatWasMissing: string
  idealAnswer: string
}

export type EvaluationResult = {
  overallScore: number
  summary: string
  questionFeedback: QuestionFeedback[]
  topStrengths: string[]
  areasToImprove: string[]
}
