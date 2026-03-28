'use client'

import { useState } from 'react'
import type { Difficulty, EvaluationResult, InterviewRole } from '@/types'
import Image from 'next/image'
import RoleSelector from '@/components/RoleSelector'
import InterviewRoom from '@/components/InterviewRoom'
import Feedback from '@/components/Feedback'

type View = 'select' | 'interview' | 'feedback'

export default function Home() {
  const [view, setView] = useState<View>('select')
  const [role, setRole] = useState<InterviewRole | null>(null)
  const [difficulty, setDifficulty] = useState<Difficulty | null>(null)
  const [evaluation, setEvaluation] = useState<EvaluationResult | null>(null)

  const onStart = (nextRole: InterviewRole, nextDifficulty: Difficulty) => {
    setRole(nextRole)
    setDifficulty(nextDifficulty)
    setEvaluation(null)
    setView('interview')
  }

  const onComplete = (result: EvaluationResult) => {
    setEvaluation(result)
    setView('feedback')
  }

  const onRestart = () => {
    setView('select')
    setRole(null)
    setDifficulty(null)
    setEvaluation(null)
  }

  return (
    <div className="min-h-screen bg-zinc-50 font-sans dark:bg-black">
      <div className="w-full max-w-3xl mx-auto px-4 py-10 flex flex-col gap-6">
        <header className="flex items-center gap-3">
          <Image
            src="/mockmate-icon.svg"
            alt="MockMate"
            width={44}
            height={44}
            className="h-11 w-11 rounded-2xl shrink-0"
            priority
          />
          <div className="leading-tight">
            <div className="text-xl font-bold text-slate-900 dark:text-white">MockMate</div>
            <div className="text-sm text-slate-600 dark:text-slate-300">AI-powered interview practice</div>
          </div>
        </header>

        <main className="flex-1">
          {view === 'select' ? (
            <RoleSelector onStart={onStart} />
          ) : null}

          {view === 'interview' && role && difficulty ? (
            <InterviewRoom role={role} difficulty={difficulty} onComplete={onComplete} />
          ) : null}

          {view === 'feedback' && evaluation ? (
            <Feedback evaluation={evaluation} onRestart={onRestart} />
          ) : null}
        </main>
      </div>
    </div>
  )
}
