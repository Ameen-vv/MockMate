 'use client'

 import type { ComponentType } from 'react'
 import { useMemo, useState } from 'react'
 import type { Difficulty, InterviewRole } from '@/types'
 import {
   Boxes,
   Code2,
   Database,
   GitBranch,
   Handshake,
 } from 'lucide-react'

 type RoleSelectorProps = {
   onStart: (role: InterviewRole, difficulty: Difficulty) => void
 }

 type RoleCardSpec = {
   role: InterviewRole
   label: string
   Icon: ComponentType<{ className?: string }>
 }

 export default function RoleSelector({ onStart }: RoleSelectorProps) {
   const [role, setRole] = useState<InterviewRole | null>(null)
   const [difficulty, setDifficulty] = useState<Difficulty | null>(null)

   const roles = useMemo<RoleCardSpec[]>(
     () => [
       { role: 'Frontend Developer', label: 'Frontend Developer', Icon: Code2 },
       { role: 'Backend Developer', label: 'Backend Developer', Icon: Database },
       { role: 'Fullstack Developer', label: 'Fullstack Developer', Icon: GitBranch },
       { role: 'System Design', label: 'System Design', Icon: Boxes },
       { role: 'HR / Behavioural', label: 'HR / Behavioural', Icon: Handshake },
     ],
     []
   )

   const canStart = role !== null && difficulty !== null

   return (
     <div className="w-full">
       <div className="text-center mb-8">
         <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
           Choose your interview setup
         </h1>
         <p className="mt-2 text-slate-600">
           Pick a role and difficulty. The AI interviewer will then start your voice interview.
         </p>
       </div>

       <div className="space-y-8">
         <section aria-label="Role selection">
           <h2 className="text-sm font-medium text-slate-700 mb-4">Role</h2>
           <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
             {roles.map(({ role: r, label, Icon }) => {
               const selected = role === r
               return (
                 <button
                   key={r}
                   type="button"
                   onClick={() => setRole(r)}
                   aria-pressed={selected}
                   className={[
                     'group flex items-center gap-3 p-4 rounded-xl border text-left transition',
                     'hover:border-slate-300',
                     selected
                       ? 'border-indigo-500 ring-2 ring-indigo-500/20 bg-indigo-50'
                       : 'border-slate-200 bg-white',
                   ].join(' ')}
                 >
                   <Icon className="h-5 w-5 text-indigo-600" />
                   <div>
                     <div className="font-medium text-slate-900">{label}</div>
                     <div className="text-xs text-slate-500 mt-0.5">
                       {r === 'Frontend Developer'
                         ? 'React, UI, performance'
                         : r === 'Backend Developer'
                           ? 'APIs, data, scalability'
                           : r === 'Fullstack Developer'
                             ? 'End-to-end systems'
                             : r === 'System Design'
                               ? 'Trade-offs & architecture'
                               : 'Communication & behaviours'}
                     </div>
                   </div>
                 </button>
               )
             })}
           </div>
         </section>

         <section aria-label="Difficulty selection">
           <h2 className="text-sm font-medium text-slate-700 mb-4">Difficulty</h2>
           <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
             {(['Junior', 'Mid', 'Senior'] as Difficulty[]).map((d) => {
               const selected = difficulty === d
               return (
                 <button
                   key={d}
                   type="button"
                   onClick={() => setDifficulty(d)}
                   aria-pressed={selected}
                   className={[
                     'px-4 py-3 rounded-xl border text-center transition',
                     'hover:border-slate-300',
                     selected
                       ? 'border-indigo-500 ring-2 ring-indigo-500/20 bg-indigo-50'
                       : 'border-slate-200 bg-white',
                   ].join(' ')}
                 >
                   <div className="font-semibold text-slate-900">{d}</div>
                   <div className="text-xs text-slate-500 mt-0.5">
                     {d === 'Junior'
                       ? 'Basics & fundamentals'
                       : d === 'Mid'
                         ? 'Depth & practical design'
                         : 'Complexity & leadership'}
                   </div>
                 </button>
               )
             })}
           </div>
         </section>

         <div className="pt-2 flex justify-center">
           <button
             type="button"
             onClick={() => {
               if (!role || !difficulty) return
               onStart(role, difficulty)
             }}
             disabled={!canStart}
             className={[
               'w-full sm:w-auto px-6 py-3 rounded-xl font-semibold transition',
               'bg-indigo-600 text-white',
               'hover:bg-indigo-700',
               'disabled:opacity-50 disabled:cursor-not-allowed',
             ].join(' ')}
           >
             Start Interview
           </button>
         </div>
       </div>
     </div>
   )
 }

