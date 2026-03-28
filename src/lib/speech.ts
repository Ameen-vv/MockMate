declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognitionInstance
    webkitSpeechRecognition?: new () => SpeechRecognitionInstance
  }
}

interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean
  interimResults: boolean
  lang: string
  start(): void
  stop(): void
  abort(): void
  onresult: ((event: SpeechRecognitionEvent) => void) | null
  onend: (() => void) | null
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null
}

interface SpeechRecognitionEvent {
  resultIndex: number
  results: SpeechRecognitionResultList
}

interface SpeechRecognitionResultList {
  length: number
  item(index: number): SpeechRecognitionResult
  [index: number]: SpeechRecognitionResult
}

interface SpeechRecognitionResult {
  length: number
  item(index: number): SpeechRecognitionAlternative
  [index: number]: SpeechRecognitionAlternative
  isFinal: boolean
}

interface SpeechRecognitionAlternative {
  transcript: string
  confidence: number
}

interface SpeechRecognitionErrorEvent {
  error: string
  message?: string
}

type VoiceWithLocal = SpeechSynthesisVoice & { localService?: boolean }

function pickBestEnglishVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  const en = voices.filter((v) => v.lang.toLowerCase().startsWith('en'))
  const pool = en.length > 0 ? en : voices
  if (pool.length === 0) return null

  const score = (v: SpeechSynthesisVoice): number => {
    let s = 0
    const lang = v.lang.toLowerCase()
    if (lang.startsWith('en-us')) s += 220
    else if (lang.startsWith('en-gb')) s += 180
    else if (lang.startsWith('en')) s += 120

    const n = v.name.toLowerCase()
    // Cloud / neural-style voices (Chrome, Edge) tend to sound more natural.
    if (n.includes('google')) s += 100
    if (n.includes('microsoft') && (n.includes('natural') || n.includes('neural'))) s += 90
    if (n.includes('neural')) s += 85
    if (n.includes('premium')) s += 70
    if (n.includes('enhanced')) s += 55
    if (n.includes('natural')) s += 50
    // Common pleasant system voices
    if (n.includes('samantha')) s += 45
    if (n.includes('aaron') || n.includes('nicky')) s += 35
    if (n.includes('daniel') || n.includes('karen') || n.includes('moira')) s += 30
    if (n.includes('siri')) s += 40

    const lv = v as VoiceWithLocal
    if (lv.localService === false) s += 35

    if (v.default) s += 8
    return s
  }

  return pool.reduce((best, v) => (score(v) > score(best) ? v : best), pool[0])
}

export function speak(text: string, onEnd?: () => void): void {
  if (typeof window === 'undefined' || !window.speechSynthesis) return
  window.speechSynthesis.cancel()

  const utterance = new SpeechSynthesisUtterance(text)
  // Slightly slower + neutral pitch reads more like a real interviewer.
  utterance.rate = 0.96
  utterance.pitch = 1.0
  utterance.volume = 1.0

  let started = false
  const start = () => {
    if (started) return
    started = true
    window.speechSynthesis.removeEventListener('voiceschanged', onVoices)
    const voice = pickBestEnglishVoice(window.speechSynthesis.getVoices())
    if (voice) utterance.voice = voice
    if (onEnd) utterance.onend = onEnd
    window.speechSynthesis.speak(utterance)
  }

  const onVoices = () => {
    start()
  }

  const voices = window.speechSynthesis.getVoices()
  if (voices.length > 0) {
    start()
    return
  }

  window.speechSynthesis.addEventListener('voiceschanged', onVoices)
  void window.speechSynthesis.getVoices()

  // If voices never load (rare), still speak with the browser default.
  window.setTimeout(() => {
    start()
  }, 750)
}

export function stopSpeaking(): void {
  if (typeof window === 'undefined' || !window.speechSynthesis) return
  window.speechSynthesis.cancel()
}

/**
 * Starts speech recognition. The session stays open across short pauses
 * (continuous + auto-restart on engine end) until the returned stop() runs.
 * Only call onEnd after a deliberate stop/abort — not when the user pauses speaking.
 */
export function startListening(
  onResult: (text: string) => void,
  onEnd?: () => void
): () => void {
  const Win = typeof window !== 'undefined' ? window : null
  const Recognition = Win?.SpeechRecognition ?? Win?.webkitSpeechRecognition
  if (!Recognition) {
    onEnd?.()
    return () => {}
  }

  const recognition = new Recognition() as SpeechRecognitionInstance
  // continuous: false ends after each phrase → Interview advanced too early.
  recognition.continuous = true
  recognition.interimResults = true
  recognition.lang = 'en-US'

  let manualStop = false
  // Keep finalized text across engine restarts (onend → start) so answers are not wiped.
  let committedTranscript = ''

  recognition.onresult = (event: SpeechRecognitionEvent) => {
    let interim = ''
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const segment = event.results[i]
      const piece = segment[0].transcript
      if (segment.isFinal) {
        committedTranscript += piece
      } else {
        interim += piece
      }
    }
    const full = (committedTranscript + interim).trim()
    if (full) onResult(full)
  }

  recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
    if (manualStop) return
    if (event.error === 'aborted') return
    // no-speech / network / others: try to keep session alive for the same answer
    window.setTimeout(() => {
      if (manualStop) return
      try {
        recognition.start()
      } catch {
        onEnd?.()
      }
    }, 150)
  }

  recognition.onend = () => {
    if (manualStop) {
      onEnd?.()
      return
    }
    // Engine stopped (e.g. Chrome quirk) — restart so the user can keep answering.
    window.setTimeout(() => {
      if (manualStop) return
      try {
        recognition.start()
      } catch {
        onEnd?.()
      }
    }, 100)
  }

  recognition.start()

  return () => {
    manualStop = true
    try {
      recognition.abort()
    } catch {
      try {
        recognition.stop()
      } catch {
        // ignore
      }
    }
  }
}
