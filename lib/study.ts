import { z } from 'zod';
export const routineSchema = z.object({
  id: z.string().min(1).max(80), subject: z.string().trim().min(1).max(80),
  note: z.string().max(200), start: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  end: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/), days: z.array(z.number().int().min(0).max(6)).min(1).max(7),
  enabled: z.boolean(), block: z.boolean(), remind: z.boolean(), color: z.enum(['green','blue','peach','purple']),
}).refine(r=>r.end>r.start, {message:'End time must be later than start time.'});
export const sessionSchema = z.object({id:z.string().max(80), subject:z.string().min(1).max(80), startedAt:z.number().int().positive(),endsAt:z.number().int().positive(),duration:z.number().int().min(1).max(180)}).refine(s=>s.endsAt>s.startedAt && s.endsAt-s.startedAt<=180*60000);
export const stateSchema = z.object({
  routines: z.array(routineSchema).max(100),
  blocking: z.object({youtube:z.boolean(),instagram:z.boolean(),facebook:z.boolean(),tiktok:z.boolean()}),
  session: sessionSchema.nullable(),
  history: z.array(z.object({id:z.string().max(80),subject:z.string().max(80),minutes:z.number().min(0).max(180),endedAt:z.number().int().positive(),completed:z.boolean()})).max(1000),
  completions: z.array(z.string().max(120)).max(1000),
  preferences: z.object({name:z.string().max(40),dailyGoal:z.number().int().min(15).max(720),reminders:z.boolean()}),
});
export type Routine = z.infer<typeof routineSchema>;
export type StudyState = z.infer<typeof stateSchema>;
export type StudySession = z.infer<typeof sessionSchema>;
export const emptyState: StudyState={routines:[],blocking:{youtube:true,instagram:true,facebook:true,tiktok:true},session:null,history:[],completions:[],preferences:{name:'',dailyGoal:120,reminders:false}};
export function dayKey(date=new Date()){return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;}
export function timeLabel(time:string){const [h,m]=time.split(':').map(Number);return `${h%12||12}:${String(m).padStart(2,'0')} ${h<12?'AM':'PM'}`;}
export function routineActive(r:Routine,date=new Date()){const t=`${String(date.getHours()).padStart(2,'0')}:${String(date.getMinutes()).padStart(2,'0')}`;return r.enabled && r.days.includes(date.getDay()) && t>=r.start && t<r.end;}
