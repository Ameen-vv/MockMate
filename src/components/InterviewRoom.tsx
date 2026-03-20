 'use client'

 import { useEffect, useMemo, useRef, useState } from 'react'
 import { Mic, MicOff, Volume2, Loader2 } from 'lucide-react'
 import { speak, startListening } from '@/lib/speech'
 import type { Answer, Difficulty, EvaluationResult, InterviewRole, Question } from '@/types'

 type Status = 'loading' | 'speaking' | 'listening' | 'processing' | 'done'

 type InterviewRoomProps = {
   role: InterviewRole
   difficulty: Difficulty
   onComplete: (result: EvaluationResult) => void
 }

 function SpeakingWaves() {
   return (
     <div className="flex items-end gap-1 h-10" aria-hidden="true">
       {[0, 1, 2, 3, 4].map((i) => (
         <div
           key={i}
           className="w-1.5 bg-indigo-500 rounded-full animate-bounce"
           style={{ animationDelay: `${i * 120}ms` }}
         />
       ))}
     </div>
   )
 }

 export default function InterviewRoom({
   role,
   difficulty,
   onComplete,
 }: InterviewRoomProps) {
   const [questions, setQuestions] = useState<Question[]>([])
   const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
   const [transcript, setTranscript] = useState('')
   const [answers, setAnswers] = useState<Answer[]>([])
   const [status, setStatus] = useState<Status>('loading')
   const [error, setError] = useState<string | null>(null)

   const transcriptRef = useRef('')
   const answersRef = useRef<Answer[]>([])
   const stopListeningRef = useRef<null | (() => void)>(null)
   const finalizeRef = useRef(false)

   const totalQuestions = questions.length
   const currentQuestion = useMemo(
     () => questions[currentQuestionIndex] ?? null,
     [questions, currentQuestionIndex]
   )

   const progressPct = useMemo(() => {
     if (totalQuestions === 0) return 0
     const completed = Math.min(currentQuestionIndex, totalQuestions)
     return (completed / totalQuestions) * 100
   }, [currentQuestionIndex, totalQuestions])

   useEffect(() => {
     let cancelled = false

     async function loadQuestions() {
       setError(null)
       setStatus('loading')
       setQuestions([])
       setCurrentQuestionIndex(0)
       setTranscript('')
       setAnswers([])
       answersRef.current = []
       transcriptRef.current = ''
       finalizeRef.current = false

       try {
         const res = await fetch('/api/questions', {
           method: 'POST',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify({ role, difficulty }),
         })

         if (!res.ok) {
           throw new Error(`Failed to load questions (HTTP ${res.status})`)
         }

         const data = (await res.json()) as { questions: Question[] }
         if (!data?.questions?.length) throw new Error('No questions returned')

         if (cancelled) return
         setQuestions(data.questions)
         setCurrentQuestionIndex(0)
         setStatus('speaking')
       } catch (e) {
         console.error('[InterviewRoom] loadQuestions failed', e)
         if (!cancelled) {
           setError(e instanceof Error ? e.message : 'Failed to load questions')
         }
       }
     }

     loadQuestions()
     return () => {
       cancelled = true
     }
   }, [role, difficulty])

   // Speak the current question when we're in "speaking".
   useEffect(() => {
     if (status !== 'speaking') return
     if (!currentQuestion) return

     // Stop any ongoing STT and reset state for the new question.
     try {
       stopListeningRef.current?.()
     } catch {
       // ignore
     }
     stopListeningRef.current = null
     finalizeRef.current = false
     transcriptRef.current = ''
     setTranscript('')

     speak(currentQuestion.text, () => {
       setStatus('listening')
     })
   }, [currentQuestion, status])

   // Start STT while in "listening".
   useEffect(() => {
     if (status !== 'listening') return
     if (!currentQuestion) return

     try {
       stopListeningRef.current?.()
     } catch {
       // ignore
     }

     const stop = startListening(
       (text) => {
         transcriptRef.current = text
         setTranscript(text)
       },
       () => {
         // Recognition ended (silence or manual stop).
         void finalizeCurrentAnswer()
       }
     )

     stopListeningRef.current = stop
     return () => {
       try {
         stopListeningRef.current?.()
       } catch {
         // ignore
       }
       stopListeningRef.current = null
     }
     // eslint-disable-next-line react-hooks/exhaustive-deps
   }, [status, currentQuestionIndex])

   async function finalizeCurrentAnswer() {
     const q = currentQuestion
     if (!q) return
     if (finalizeRef.current) return
     finalizeRef.current = true

     // Ensure STT is fully stopped before moving on.
     try {
       stopListeningRef.current?.()
     } catch {
       // ignore
     }
     stopListeningRef.current = null

     const answerText = transcriptRef.current.trim()
     const nextAnswers = [...answersRef.current, { questionId: q.id, questionText: q.text, answerText }]
     answersRef.current = nextAnswers
     setAnswers(nextAnswers)

     const nextIndex = currentQuestionIndex + 1
     if (nextIndex < questions.length) {
       setCurrentQuestionIndex(nextIndex)
       setStatus('speaking')
       return
     }

     // Last question: evaluate.
     setStatus('processing')
     try {
       const res = await fetch('/api/evaluate', {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({ role, difficulty, answers: nextAnswers }),
       })

       if (!res.ok) {
         throw new Error(`Failed to evaluate (HTTP ${res.status})`)
       }

       const result = (await res.json()) as EvaluationResult
       onComplete(result)
       setStatus('done')
     } catch (e) {
       console.error('[InterviewRoom] evaluation failed', e)
       setError(e instanceof Error ? e.message : 'Failed to generate feedback')
       setStatus('done')
     }
   }

   const handleDoneAnswering = () => {
     void finalizeCurrentAnswer()
   }

   const isSpeaking = status === 'speaking'
   const isListening = status === 'listening'
   const isProcessing = status === 'processing'

   return (
     <div className="w-full">
       <div className="mb-6">
         <div className="flex items-center justify-between text-sm text-slate-600">
           <span className="font-medium">
             {totalQuestions ? `Question ${currentQuestionIndex + 1} of ${totalQuestions}` : 'Preparing interview...'}
           </span>
           <span className="tabular-nums">{Math.round(progressPct)}%</span>
         </div>
         <div className="mt-2 h-2 rounded-full bg-slate-200 overflow-hidden">
           <div
             className="h-full bg-indigo-600 transition-[width] duration-300"
             style={{ width: `${progressPct}%` }}
           />
         </div>
       </div>

       {error ? (
         <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-800">
           <div className="font-semibold">Something went wrong</div>
           <div className="text-sm mt-1">{error}</div>
         </div>
       ) : null}

       <div className="rounded-2xl border border-slate-200 bg-white p-6">
         {status === 'loading' ? (
           <div className="flex items-center gap-3 text-slate-700">
             <Loader2 className="h-5 w-5 animate-spin" />
             <span>Loading questions...</span>
           </div>
         ) : null}

         {currentQuestion && status !== 'loading' ? (
           <div className="space-y-4">
             <div className="flex items-start justify-between gap-4">
               <div className="flex-1">
                 <div className="text-sm text-slate-500">Interview question</div>
                 <div className="text-lg font-semibold text-slate-900 mt-1">
                   {currentQuestion.text}
                 </div>
               </div>

               <div className="shrink-0 flex items-center gap-3">
                 {isSpeaking ? (
                   <div className="flex items-center gap-2 text-indigo-700">
                     <Volume2 className="h-5 w-5" />
                     <SpeakingWaves />
                   </div>
                 ) : null}
                 {isListening ? (
                   <div className="flex items-center gap-2 text-indigo-700">
                     <Mic className="h-6 w-6 animate-pulse" />
                     <span className="text-sm font-medium">Listening</span>
                   </div>
                 ) : null}
               </div>
             </div>

             <div className="rounded-xl bg-slate-50 border border-slate-100 p-4">
               <div className="text-sm font-medium text-slate-700">Your live transcript</div>
               <div className="text-sm text-slate-800 mt-1 min-h-12 whitespace-pre-wrap">
                 {transcript ? transcript : <span className="text-slate-400">Start speaking when the mic is on.</span>}
               </div>
             </div>

             {isListening ? (
               <div className="flex justify-center">
                 <button
                   type="button"
                   onClick={handleDoneAnswering}
                   className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold transition bg-indigo-600 text-white hover:bg-indigo-700"
                 >
                   <MicOff className="h-5 w-5" />
                   Done Answering
                 </button>
               </div>
             ) : null}

             {isProcessing ? (
               <div className="flex items-center gap-3 text-slate-700">
                 <Loader2 className="h-5 w-5 animate-spin" />
                 <span>Generating feedback...</span>
               </div>
             ) : null}
           </div>
         ) : null}

         {status === 'done' && !isProcessing ? (
           <div className="text-sm text-slate-600">
             Interview complete. Preparing feedback...
           </div>
         ) : null}
       </div>
     </div>
   )
 }

