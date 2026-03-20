 'use client'

 import { useMemo, useState } from 'react'
 import { ChevronDown, ChevronUp, Copy, RotateCcw } from 'lucide-react'
 import type { EvaluationResult, QuestionFeedback } from '@/types'

 type FeedbackProps = {
   evaluation: EvaluationResult
   onRestart: () => void
 }

 function scoreColorClass(score: number): string {
   if (score >= 7) return 'bg-green-600 text-white'
   if (score >= 5) return 'bg-amber-500 text-white'
   return 'bg-red-600 text-white'
 }

 function Pill({
   children,
   className,
 }: {
   children: React.ReactNode
   className: string
 }) {
   return (
     <span className={['inline-flex px-3 py-1 rounded-full text-xs font-medium', className].join(' ')}>
       {children}
     </span>
   )
 }

 function formatQuestionCard(q: QuestionFeedback): string {
   return `Question: ${q.question}\n\nYour answer:\n${q.answer}\n\nScore: ${q.score}/10\n\nWhat was good:\n${q.whatWasGood}\n\nWhat was missing:\n${q.whatWasMissing}\n\nIdeal answer:\n${q.idealAnswer}`
 }

 export default function Feedback({ evaluation, onRestart }: FeedbackProps) {
   const [expandedId, setExpandedId] = useState<number | null>(null)

   const badgeClass = useMemo(
     () => scoreColorClass(evaluation.overallScore),
     [evaluation.overallScore]
   )

   const badgeLabel = useMemo(() => {
     if (evaluation.overallScore >= 7) return 'Strong'
     if (evaluation.overallScore >= 5) return 'Good'
     return 'Needs Improvement'
   }, [evaluation.overallScore])

   const reportText = useMemo(() => {
     const lines: string[] = []
     lines.push(`MockMate Interview Feedback`)
     lines.push(`Overall score: ${evaluation.overallScore}/10 (${badgeLabel})`)
     lines.push(`Summary: ${evaluation.summary}`)
     lines.push('')
     lines.push(`Top strengths:`)
     for (const s of evaluation.topStrengths) lines.push(`- ${s}`)
     lines.push('')
     lines.push(`Areas to improve:`)
     for (const a of evaluation.areasToImprove) lines.push(`- ${a}`)
     lines.push('')

     for (const q of evaluation.questionFeedback) {
       lines.push(formatQuestionCard(q))
       lines.push('')
       lines.push('---')
       lines.push('')
     }
     return lines.join('\n')
   }, [evaluation, badgeLabel])

   const copyReport = async () => {
     try {
       await navigator.clipboard.writeText(reportText)
     } catch {
       // Fallback for older browsers / clipboard permissions.
       const ta = document.createElement('textarea')
       ta.value = reportText
       ta.style.position = 'fixed'
       ta.style.left = '-9999px'
       document.body.appendChild(ta)
       ta.select()
       document.execCommand('copy')
       document.body.removeChild(ta)
     }
   }

   return (
     <div className="w-full">
       <div className="flex flex-col items-center text-center mb-6">
         <div
           className={[
             'relative w-28 h-28 rounded-full flex items-center justify-center',
             badgeClass,
             'shadow-sm',
           ].join(' ')}
           aria-label={`Overall score ${evaluation.overallScore} out of 10`}
         >
           <div className="absolute inset-0 rounded-full ring-1 ring-black/10" />
           <div className="relative z-10">
             <div className="text-2xl font-bold leading-none">{evaluation.overallScore}</div>
             <div className="text-xs font-medium opacity-90">/10</div>
             <div className="mt-1 text-xs font-semibold">{badgeLabel}</div>
           </div>
         </div>
         <div className="mt-4">
           <div className="text-sm text-slate-600">Overall performance</div>
           <p className="mt-2 text-base text-slate-800">{evaluation.summary}</p>
         </div>
       </div>

       <div className="flex flex-col sm:flex-row gap-4 mb-6">
         <div className="flex-1 rounded-2xl border border-slate-200 bg-white p-4">
           <div className="text-sm font-semibold text-slate-900">Top strengths</div>
           <div className="mt-2 flex flex-wrap gap-2">
             {evaluation.topStrengths.map((s) => (
               <Pill key={s} className="bg-green-50 text-green-800 ring-1 ring-green-200">
                 {s}
               </Pill>
             ))}
           </div>
         </div>
         <div className="flex-1 rounded-2xl border border-slate-200 bg-white p-4">
           <div className="text-sm font-semibold text-slate-900">Areas to improve</div>
           <div className="mt-2 flex flex-wrap gap-2">
             {evaluation.areasToImprove.map((a) => (
               <Pill key={a} className="bg-red-50 text-red-800 ring-1 ring-red-200">
                 {a}
               </Pill>
             ))}
           </div>
         </div>
       </div>

       <div className="space-y-3">
         {evaluation.questionFeedback.map((q) => {
           const expanded = expandedId === q.questionId
           return (
             <div key={q.questionId} className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
               <button
                 type="button"
                 onClick={() => setExpandedId(expanded ? null : q.questionId)}
                 className="w-full text-left p-4 flex items-start justify-between gap-4"
               >
                 <div className="min-w-0">
                   <div className="text-xs font-medium text-slate-500">Question {q.questionId}</div>
                   <div className="text-sm font-semibold text-slate-900 mt-1">{q.question}</div>
                   <div className="text-sm text-slate-700 mt-2 line-clamp-2">Your answer: {q.answer}</div>
                 </div>

                 <div className="shrink-0 flex items-center gap-3">
                   <div
                     className={[
                       'w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold',
                       scoreColorClass(q.score),
                     ].join(' ')}
                   >
                     {q.score}
                   </div>
                   {expanded ? <ChevronUp className="h-5 w-5 text-slate-500" /> : <ChevronDown className="h-5 w-5 text-slate-500" />}
                 </div>
               </button>

               {expanded ? (
                 <div className="p-4 pt-0">
                   <div className="grid gap-4 md:grid-cols-2">
                     <div className="rounded-xl bg-green-50 ring-1 ring-green-200 p-4">
                       <div className="text-xs font-semibold text-green-900">What was good</div>
                       <div className="text-sm text-green-900 mt-2 whitespace-pre-wrap">{q.whatWasGood}</div>
                     </div>
                     <div className="rounded-xl bg-red-50 ring-1 ring-red-200 p-4">
                       <div className="text-xs font-semibold text-red-900">What was missing</div>
                       <div className="text-sm text-red-900 mt-2 whitespace-pre-wrap">{q.whatWasMissing}</div>
                     </div>
                   </div>

                   <div className="mt-4 rounded-xl bg-indigo-50 ring-1 ring-indigo-200 p-4">
                     <div className="text-xs font-semibold text-indigo-900">Ideal answer</div>
                     <div className="text-sm text-indigo-900 mt-2 whitespace-pre-wrap">{q.idealAnswer}</div>
                   </div>
                 </div>
               ) : null}
             </div>
           )
         })}
       </div>

       <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
         <button
           type="button"
           onClick={onRestart}
           className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-semibold transition bg-slate-900 text-white hover:bg-slate-800"
         >
           <RotateCcw className="h-5 w-5" />
           Start New Interview
         </button>
         <button
           type="button"
           onClick={copyReport}
           className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-semibold transition bg-white text-slate-900 hover:bg-slate-50 border border-slate-200"
         >
           <Copy className="h-5 w-5" />
           Copy Full Report
         </button>
       </div>
     </div>
   )
 }

