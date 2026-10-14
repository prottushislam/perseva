import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Tone = "sage" | "peach";
export type Priority = "low" | "medium" | "high";

export type Routine = {
  id: string;
  subject: string;
  note: string;
  start: string;
  end: string;
  days: number[];
  enabled: boolean;
  color: Tone;
};

export type StudySession = {
  id: string;
  subject: string;
  startedAt: number;
  endsAt: number;
  duration: number;
};

export type HistoryItem = {
  id: string;
  subject: string;
  minutes: number;
  endedAt: number;
  completed: boolean;
};

export type Assignment = {
  id: string;
  title: string;
  subject: string;
  due: string;
  priority: Priority;
  completed: boolean;
  note: string;
  color: Tone;
};

export type Exam = {
  id: string;
  title: string;
  subject: string;
  date: string;
  note: string;
  color: Tone;
};

export type Note = {
  id: string;
  title: string;
  content: string;
  subject: string;
  updatedAt: number;
};

export type Preferences = {
  name: string;
  dailyGoal: number;
};

type Data = {
  routines: Routine[];
  session: StudySession | null;
  history: HistoryItem[];
  completions: string[];
  preferences: Preferences;
  assignments: Assignment[];
  exams: Exam[];
  notes: Note[];
};

type Actions = {
  upsertRoutine: (routine: Routine) => void;
  removeRoutine: (id: string) => void;
  addStarter: () => void;
  toggleCompletion: (key: string) => void;
  startSession: (subject: string, minutes: number) => void;
  endSession: (completed: boolean) => void;
  setPreferences: (next: Preferences) => void;
  upsertAssignment: (item: Assignment) => void;
  removeAssignment: (id: string) => void;
  toggleAssignment: (id: string) => void;
  upsertExam: (item: Exam) => void;
  removeExam: (id: string) => void;
  upsertNote: (item: Note) => void;
  removeNote: (id: string) => void;
};

const empty: Data = {
  routines: [],
  session: null,
  history: [],
  completions: [],
  preferences: { name: "", dailyGoal: 120 },
  assignments: [],
  exams: [],
  notes: [],
};

export const useStudy = create<Data & Actions>()(
  persist(
    (set, get) => ({
      ...empty,
      upsertRoutine: (routine) =>
        set((s) => ({
          routines: s.routines.some((r) => r.id === routine.id)
            ? s.routines.map((r) => (r.id === routine.id ? routine : r))
            : [...s.routines, routine].slice(0, 100),
        })),
      removeRoutine: (id) => set((s) => ({ routines: s.routines.filter((r) => r.id !== id) })),
      addStarter: () =>
        set((s) => ({
          routines: [
            ...s.routines,
            ...[
              { subject: "Mathematics", note: "One concept. A few practice problems.", start: "09:00", end: "09:50", color: "sage" as const },
              { subject: "Reading & revision", note: "Read, recall, and write a short summary.", start: "14:00", end: "14:45", color: "sage" as const },
              { subject: "Evening review", note: "A gentle review of what you learned today.", start: "19:00", end: "19:30", color: "peach" as const },
            ].map((r) => ({
              ...r,
              id: crypto.randomUUID(),
              days: [1, 2, 3, 4, 5],
              enabled: true,
            })),
          ].slice(0, 100),
        })),
      toggleCompletion: (key) =>
        set((s) => ({
          completions: s.completions.includes(key)
            ? s.completions.filter((x) => x !== key)
            : [...s.completions, key].slice(-1000),
        })),
      startSession: (subject, minutes) => {
        const startedAt = Date.now();
        set({
          session: {
            id: crypto.randomUUID(),
            subject: subject.trim() || "Deep work",
            startedAt,
            endsAt: startedAt + minutes * 60_000,
            duration: minutes,
          },
        });
      },
      endSession: (completed) => {
        const session = get().session;
        if (!session) return;
        const elapsed = Math.max(0, Math.min(session.duration, (Date.now() - session.startedAt) / 60_000));
        const minutes = completed ? session.duration : Math.round(elapsed * 10) / 10;
        set((s) => ({
          session: null,
          history: [
            ...s.history,
            {
              id: session.id,
              subject: session.subject,
              minutes,
              endedAt: Date.now(),
              completed,
            },
          ].slice(-400),
        }));
      },
      setPreferences: (preferences) => set({ preferences }),
      upsertAssignment: (item) =>
        set((s) => ({
          assignments: s.assignments.some((a) => a.id === item.id)
            ? s.assignments.map((a) => (a.id === item.id ? item : a))
            : [...s.assignments, item].slice(0, 100),
        })),
      removeAssignment: (id) => set((s) => ({ assignments: s.assignments.filter((a) => a.id !== id) })),
      toggleAssignment: (id) =>
        set((s) => ({
          assignments: s.assignments.map((a) => (a.id === id ? { ...a, completed: !a.completed } : a)),
        })),
      upsertExam: (item) =>
        set((s) => ({
          exams: s.exams.some((e) => e.id === item.id)
            ? s.exams.map((e) => (e.id === item.id ? item : e))
            : [...s.exams, item].slice(0, 50),
        })),
      removeExam: (id) => set((s) => ({ exams: s.exams.filter((e) => e.id !== id) })),
      upsertNote: (item) =>
        set((s) => ({
          notes: s.notes.some((n) => n.id === item.id)
            ? s.notes.map((n) => (n.id === item.id ? item : n))
            : [...s.notes, item].slice(0, 100),
        })),
      removeNote: (id) => set((s) => ({ notes: s.notes.filter((n) => n.id !== id) })),
    }),
    {
      name: "perseva-space",
      skipHydration: true,
      partialize: (s) => ({
        routines: s.routines,
        session: s.session,
        history: s.history,
        completions: s.completions,
        preferences: s.preferences,
        assignments: s.assignments,
        exams: s.exams,
        notes: s.notes,
      }),
    },
  ),
);

export const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

export function dayKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function timeLabel(time: string) {
  const [h, m] = time.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}

export function routineActive(r: Routine, date = new Date()) {
  const t = `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
  return r.enabled && r.days.includes(date.getDay()) && t >= r.start && t < r.end;
}

export function daysUntil(dateStr: string) {
  const due = new Date(`${dateStr}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((due.getTime() - today.getTime()) / 86_400_000);
}

export function dueLabel(days: number, done: boolean) {
  if (done) return "Done";
  if (days < 0) return `${-days}d overdue`;
  if (days === 0) return "Due today";
  if (days === 1) return "Due tomorrow";
  return `${days}d left`;
}
