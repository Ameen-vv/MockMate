# MockMate

**AI-powered voice interview practice** — pick a role and difficulty, answer spoken questions in the browser, and get structured feedback on your answers.

> **Status:** This project is **under active development**. Features and behavior may change; use it for experimentation and learning rather than production-critical workflows.

## What it does

- Choose an **interview type** (e.g. Frontend, Backend, System Design) and **difficulty** (Junior / Mid / Senior).
- The app generates **interview questions** via the **Groq API**, reads each question aloud (**Speech Synthesis**), and transcribes your spoken answers (**Speech Recognition**).
- After the session, answers are **evaluated** by the API and you see **scores**, **strengths**, **areas to improve**, and **per-question feedback**.

There is **no database** — each run is **stateless** for that browser session.

## Tech stack

| Area | Choice |
|------|--------|
| Framework | [Next.js](https://nextjs.org/) (App Router, `src/`) |
| Language | TypeScript |
| Styling | Tailwind CSS |
| AI | [Groq](https://console.groq.com/) (`llama-3.3-70b-versatile`) |
| Icons | [lucide-react](https://lucide.dev/) |
| Voice | Web Speech API (TTS + STT) — **client-side only** |

## Prerequisites

- **Node.js** 18+ (or current LTS)
- A **Groq API key** from [console.groq.com](https://console.groq.com/)

## Environment variables

Create `.env.local` in the project root:

```bash
GROQ_API_KEY=your_key_here
```

Never commit real keys. `.env.local` is gitignored by default.

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). For **SpeechRecognition**, **Chrome** is recommended; other browsers may have limited or inconsistent support.

### Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run start` | Run production server (after `build`) |
| `npm run lint` | ESLint |

## Deployment (e.g. Vercel)

1. Add `GROQ_API_KEY` in the host’s environment variables.
2. Deploy the Next.js app; API routes live under `src/app/api/`.
3. `vercel.json` configures extended timeouts for the Groq routes — adjust if your provider limits differ.

## Project layout (overview)

```
src/
  app/
    api/questions/   # POST — generate questions
    api/evaluate/    # POST — evaluate answers
    page.tsx         # Main UI flow (select → interview → feedback)
    layout.tsx
  components/        # RoleSelector, InterviewRoom, Feedback
  lib/               # groq.ts, speech.ts
  types/             # Shared TypeScript types
public/
  mockmate-icon.svg  # App / favicon artwork
```

## Contributing & feedback

Issues and PRs are welcome. Because the product is still in development, breaking changes are possible between versions.

## License

No license is bundled by default. Add a `LICENSE` file when you are ready to specify terms for others.
