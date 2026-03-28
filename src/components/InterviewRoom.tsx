'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Mic, MicOff, Volume2, Loader2, AlertTriangle } from 'lucide-react'
import { speak, startListening, stopSpeaking } from '@/lib/speech'
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
  const [sttSupported, setSttSupported] = useState(true)
  const [micPermission, setMicPermission] = useState<'unknown' | 'granted' | 'denied'>('unknown')

   const transcriptRef = useRef('')
   const answersRef = useRef<Answer[]>([])
   const stopListeningRef = useRef<null | (() => void)>(null)
   const finalizeRef = useRef(false)
  const listeningQuestionIdRef = useRef<number | null>(null)

   const totalQuestions = questions.length
   const currentQuestion = useMemo(
     () => questions[currentQuestionIndex] ?? null,
     [questions, currentQuestionIndex]
   )

   const progressPct = useMemo(() => {
     if (totalQuestions === 0) return 0
    const completedCount =
      status === 'processing' || status === 'done' ? currentQuestionIndex + 1 : currentQuestionIndex
    const completed = Math.min(completedCount, totalQuestions)
    return (completed / totalQuestions) * 100
  }, [currentQuestionIndex, status, totalQuestions])

  useEffect(() => {
    const supported =
      typeof window !== 'undefined' &&
      (!!window.SpeechRecognition || !!window.webkitSpeechRecognition)
    setSttSupported(supported)
  }, [])

  // Request microphone access on mount so we can fail fast with a clear message.
  useEffect(() => {
    let cancelled = false

    async function checkMic() {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error('Your browser does not support microphone access.')
        }

        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        stream.getTracks().forEach((t) => t.stop())
        if (!cancelled) setMicPermission('granted')
      } catch (e) {
        console.error('[InterviewRoom] microphone permission failed', e)
        if (cancelled) return
        setMicPermission('denied')
        setError(
          'Microphone permission was denied. Please enable microphone access in your browser settings, then refresh and try again.'
        )
        setStatus('done')
        stopSpeaking()
      }
    }

    checkMic()

    return () => {
      cancelled = true
    }
  }, [])

   useEffect(() => {
     let cancelled = false
    if (micPermission !== 'granted') return

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
  }, [role, difficulty, micPermission])

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
    listeningQuestionIdRef.current = null
     transcriptRef.current = ''
     setTranscript('')

     speak(currentQuestion.text, () => {
      if (micPermission !== 'granted') {
        setError(
          'Microphone permission was not granted. Please enable it and restart the interview.'
        )
        setStatus('done')
        return
      }
      setStatus('listening')
     })
  }, [currentQuestion, status, micPermission])

   // Start STT while in "listening".
   useEffect(() => {
     if (status !== 'listening') return
     if (!currentQuestion) return
    if (sttSupported === false) {
      setError(
        'Speech recognition is not supported in this browser. Please use Chrome for the best results.'
      )
      setStatus('done')
      return
    }
    if (micPermission !== 'granted') {
      setError(
        'Microphone permission was not granted. Please enable it and restart the interview.'
      )
      setStatus('done')
      return
    }

     try {
       stopListeningRef.current?.()
     } catch {
       // ignore
     }

    const qId = currentQuestion.id
    listeningQuestionIdRef.current = qId
    finalizeRef.current = false

    // Do not advance on STT `onend` — pauses/silence used to finalize too early.
    // User must use "Done Answering" or Space. Stop() runs onEnd when we abort.
    const stop = startListening((text) => {
      transcriptRef.current = text
      setTranscript(text)
    })

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
  }, [status, currentQuestionIndex, currentQuestion, micPermission, sttSupported])

  const finalizeCurrentAnswer = useCallback(
    async (forQuestionId: number) => {
      if (listeningQuestionIdRef.current !== forQuestionId) return

      const q = questions.find((qq) => qq.id === forQuestionId)
      if (!q) return
      if (finalizeRef.current) return
      finalizeRef.current = true
      listeningQuestionIdRef.current = null

      // Ensure STT is fully stopped before moving on.
      try {
        stopListeningRef.current?.()
      } catch {
        // ignore
      }
      stopListeningRef.current = null

      const answerText = transcriptRef.current.trim()
      const nextAnswers = [
        ...answersRef.current,
        { questionId: q.id, questionText: q.text, answerText },
      ]
      answersRef.current = nextAnswers
      setAnswers(nextAnswers)

      const qIndex = questions.findIndex((qq) => qq.id === forQuestionId)
      const nextIndex = (qIndex >= 0 ? qIndex : currentQuestionIndex) + 1
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
    },
    [currentQuestionIndex, difficulty, onComplete, questions, role]
  )

   const handleDoneAnswering = () => {
    if (!currentQuestion) return
    void finalizeCurrentAnswer(currentQuestion.id)
   }

  // Space bar = stop listening (same as Done Answering)
  useEffect(() => {
    if (status !== 'listening') return
    if (!currentQuestion) return

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code !== 'Space' && e.key !== ' ') return
      e.preventDefault()
      void finalizeCurrentAnswer(currentQuestion.id)
    }

    window.addEventListener('keydown', onKeyDown, { passive: false })
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [status, currentQuestion, finalizeCurrentAnswer])

   const isSpeaking = status === 'speaking'
   const isListening = status === 'listening'
   const isProcessing = status === 'processing'

   return (
     <div className="w-full">
       <div className="mb-6">
        {!sttSupported ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 mb-4 text-amber-900">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-5 w-5 mt-0.5" />
              <div>
                <div className="font-semibold">Browser note</div>
                <div className="text-sm mt-1">
                  MockMate works best in Chrome. Some features may not work in other browsers.
                </div>
              </div>
            </div>
          </div>
        ) : null}

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
        {micPermission !== 'granted' ? (
          <div className="flex items-center gap-3 text-slate-700">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>{micPermission === 'denied' ? 'Microphone access needed' : 'Checking microphone permission...'}</span>
          </div>
        ) : status === 'loading' ? (
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
                {totalQuestions ? (
                  <div className="text-xs text-slate-500 mt-2">
                    Answers saved: {answers.length} / {totalQuestions}
                  </div>
                ) : null}
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

