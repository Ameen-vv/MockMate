import Groq from 'groq-sdk'

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
})

export async function askGroq(prompt: string): Promise<string> {
  const completion = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    temperature: 0.4,
    messages: [{ role: 'user', content: prompt }],
  })

  const content = completion.choices[0]?.message?.content
  return content ?? ''
}
