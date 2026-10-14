import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  BookOpen,
  CalendarDays,
  Check,
  CheckCircle2,
  Clock3,
  Flame,
  Headphones,
  LayoutDashboard,
  Leaf,
  Menu,
  Pencil,
  Plus,
  Settings2,
  Timer,
  Trash2,
  X,
} from "lucide-react";
import {
  DAYS,
  dayKey,
  daysUntil,
  dueLabel,
  routineActive,
  timeLabel,
  useStudy,
  type Assignment,
  type Exam,
  type Note,
  type Routine,
} from "@/lib/study";
import { Soundscape, type SoundKind } from "@/lib/soundscape";

export const Route = createFileRoute("/")({ component: Home });

type View = "today" | "schedule" | "focus" | "tasks" | "sounds" | "progress";

const NAV: { id: View; label: string; icon: typeof LayoutDashboard }[] = [
  { id: "today", label: "Today", icon: LayoutDashboard },
  { id: "schedule", label: "Schedule", icon: CalendarDays },
  { id: "focus", label: "Focus", icon: Timer },
  { id: "tasks", label: "Tasks", icon: CheckCircle2 },
  { id: "sounds", label: "Sounds", icon: Headphones },
  { id: "progress", label: "Progress", icon: Flame },
];

function Home() {
  const store = useStudy();
  const [ready, setReady] = useState(false);
  const [view, setView] = useState<View>("today");
  const [now, setNow] = useState(() => Date.now());
  const [menu, setMenu] = useState(false);
  const [toast, setToast] = useState("");
  const [settings, setSettings] = useState(false);
  const [editor, setEditor] = useState<Routine | null>(null);
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [exam, setExam] = useState<Exam | null>(null);
  const [note, setNote] = useState<Note | null>(null);
  const [selectedDay, setSelectedDay] = useState(() => new Date().getDay());
  const [duration, setDuration] = useState(25);
  const [custom, setCustom] = useState(false);
  const [subject, setSubject] = useState("Deep work");
  const [mode, setMode] = useState<"focus" | "break">("focus");
  const [breakEnd, setBreakEnd] = useState<number | null>(null);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [sound, setSound] = useState<SoundKind | null>(null);
  const [volume, setVolume] = useState(0.22);
  const audio = useRef<Soundscape | null>(null);
  const ending = useRef(false);

  useEffect(() => {
    void useStudy.persist.rehydrate();
    setReady(true);
    const tick = window.setInterval(() => setNow(Date.now()), 1000);
    return () => {
      window.clearInterval(tick);
      audio.current?.dispose();
    };
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(""), 4200);
    return () => window.clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    if (!store.session || store.session.endsAt > now || ending.current) return;
    ending.current = true;
    store.endSession(true);
    setMode("break");
    setToast("You showed up. Your focus session is complete.");
    ending.current = false;
  }, [now, store]);

  useEffect(() => {
    if (breakEnd && breakEnd <= now) {
      setBreakEnd(null);
      setMode("focus");
      setToast("Break complete. Ready for another small step?");
    }
  }, [breakEnd, now]);

  const date = new Date(now);
  const today = dayKey(date);
  const todayRoutines = store.routines
    .filter((r) => r.enabled && r.days.includes(date.getDay()))
    .sort((a, b) => a.start.localeCompare(b.start));
  const totalToday = store.history
    .filter((h) => dayKey(new Date(h.endedAt)) === today)
    .reduce((sum, h) => sum + h.minutes, 0);
  const finishedToday = store.completions.filter((x) => x.startsWith(`${today}:`)).length;

  const streak = useMemo(() => {
    const active = new Set(
      store.history.filter((h) => h.minutes >= 1).map((h) => dayKey(new Date(h.endedAt))),
    );
    let count = 0;
    const cursor = new Date(date);
    if (!active.has(dayKey(cursor))) cursor.setDate(cursor.getDate() - 1);
    while (active.has(dayKey(cursor))) {
      count += 1;
      cursor.setDate(cursor.getDate() - 1);
    }
    return count;
  }, [store.history, today]);

  const weekly = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(date);
      const mondayOffset = (d.getDay() + 6) % 7;
      d.setDate(d.getDate() - mondayOffset + i);
      const key = dayKey(d);
      const minutes = store.history
        .filter((h) => dayKey(new Date(h.endedAt)) === key)
        .reduce((sum, h) => sum + h.minutes, 0);
      return { label: DAYS[d.getDay()].slice(0, 1), minutes, key };
    });
  }, [store.history, today]);

  function go(next: View) {
    setView(next);
    setMenu(false);
  }

  async function play(kind: SoundKind) {
    if (sound === kind) {
      audio.current?.stop();
      setSound(null);
      return;
    }
    if (!audio.current) audio.current = new Soundscape();
    await audio.current.play(kind, volume);
    setSound(kind);
  }

  function changeVolume(value: number) {
    setVolume(value);
    audio.current?.volume(value);
  }

  const headings: Record<View, { title: string; copy: string }> = {
    today: {
      title: store.preferences.name ? `Make today yours, ${store.preferences.name}.` : "A little focus. A brighter day.",
      copy: "Your space to learn, one small step at a time.",
    },
    schedule: { title: "Your time, thoughtfully planned.", copy: "Build a study rhythm that works for you." },
    focus: { title: "One thing at a time.", copy: "Set an intention and let the distractions wait." },
    tasks: { title: "What needs your attention.", copy: "Deadlines, exams, and the notes you want to keep." },
    sounds: { title: "Find your kind of quiet.", copy: "A soft background while you stay with the work." },
    progress: { title: "Every session counts.", copy: "A clear view of the time you’ve invested." },
  };

  return (
    <div className="min-h-screen bg-bg text-ink">
      <aside
        className={`fixed inset-y-0 left-0 z-30 flex w-60 flex-col border-r border-line bg-surface px-4 py-7 transition-transform md:translate-x-0 ${menu ? "translate-x-0" : "-translate-x-full"}`}
      >
        <button type="button" className="mb-10 flex items-center gap-2 px-2" onClick={() => go("today")}>
          <span className="grid size-10 place-items-center rounded-xl bg-sage text-lg font-bold text-white">P</span>
          <span className="font-display text-2xl font-extrabold tracking-tight">
            perseva<span className="text-leaf">.</span>
          </span>
        </button>
        <p className="mb-3 px-3 text-xs font-semibold tracking-widest text-muted">WORKSPACE</p>
        <nav className="flex flex-col gap-1">
          {NAV.map((item) => {
            const Icon = item.icon;
            const active = view === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => go(item.id)}
                className={`flex items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-medium ${active ? "bg-sage-soft text-sage" : "text-muted hover:bg-bg"}`}
              >
                <Icon size={18} />
                {item.label}
                {item.id === "focus" && store.session ? <span className="ml-auto size-2 rounded-full bg-leaf" /> : null}
              </button>
            );
          })}
        </nav>
        <div className="mt-auto rounded-2xl bg-sage-soft p-4 text-sage">
          <Leaf size={20} />
          <p className="mt-2 text-sm leading-relaxed text-ink">
            Progress is a practice. <strong>Keep showing up.</strong>
          </p>
          <p className="mt-1 text-xs text-muted">One small step, every day.</p>
        </div>
      </aside>
      {menu ? (
        <button type="button" aria-label="Close menu" className="fixed inset-0 z-20 bg-ink/30 md:hidden" onClick={() => setMenu(false)} />
      ) : null}

      <div className="md:pl-60">
        <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-line bg-surface/90 px-4 backdrop-blur md:px-8">
          <div className="flex items-center gap-2 text-sm text-muted">
            <button type="button" className="grid size-10 place-items-center rounded-xl md:hidden" aria-label="Open menu" onClick={() => setMenu(true)}>
              <Menu size={20} />
            </button>
            <span>Perseva</span>
            <span className="opacity-40">/</span>
            <strong className="text-ink">{NAV.find((n) => n.id === view)?.label}</strong>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden items-center gap-2 text-sm text-muted sm:flex">
              <CalendarDays size={15} />
              {date.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}
            </span>
            <button type="button" aria-label="Settings" className="grid size-10 place-items-center rounded-full bg-sage-soft text-sage" onClick={() => setSettings(true)}>
              {store.preferences.name ? store.preferences.name[0].toUpperCase() : <Settings2 size={18} />}
            </button>
          </div>
        </header>

        <main className="mx-auto max-w-6xl px-4 py-6 pb-28 md:px-8 md:pb-10">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold tracking-widest text-muted uppercase">
                {date.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}
              </p>
              <h1 className="mt-1 max-w-xl text-3xl font-bold leading-tight md:text-4xl">{headings[view].title}</h1>
              <p className="mt-2 max-w-md text-muted">{headings[view].copy}</p>
            </div>
            {view === "today" ? (
              <Goal minutes={totalToday} goal={store.preferences.dailyGoal} />
            ) : null}
            {view === "schedule" ? (
              <button type="button" className="inline-flex h-11 items-center gap-2 rounded-xl bg-sage px-4 text-sm font-semibold text-white" onClick={() => setEditor(blankRoutine(selectedDay))}>
                <Plus size={16} /> Add study block
              </button>
            ) : null}
          </div>

          {!ready ? <p className="text-muted">Opening your study space…</p> : null}

          {view === "today" ? (
            <Today
              routines={todayRoutines}
              date={date}
              today={today}
              completions={store.completions}
              assignments={store.assignments}
              exams={store.exams}
              totalToday={totalToday}
              goal={store.preferences.dailyGoal}
              streak={streak}
              finished={finishedToday}
              hasAny={store.routines.length > 0}
              onToggle={(id) => store.toggleCompletion(`${today}:${id}`)}
              onEdit={setEditor}
              onAdd={() => setEditor(blankRoutine(date.getDay()))}
              onStarter={() => {
                store.addStarter();
                setToast("Starter routine saved. Make it yours.");
              }}
              onOpenSchedule={(day) => {
                setSelectedDay(day);
                go("schedule");
              }}
              onOpenTasks={() => go("tasks")}
              focus={
                <FocusCard
                  mode={mode}
                  setMode={setMode}
                  duration={duration}
                  setDuration={setDuration}
                  custom={custom}
                  setCustom={setCustom}
                  subject={subject}
                  setSubject={setSubject}
                  session={store.session}
                  breakEnd={breakEnd}
                  now={now}
                  sound={sound}
                  volume={volume}
                  onVolume={changeVolume}
                  onPlay={(kind) => void play(kind)}
                  onStart={() => {
                    if (mode === "break") {
                      setBreakEnd(Date.now() + 5 * 60_000);
                      return;
                    }
                    store.startSession(subject, duration);
                    setToast("One small step. You’ve got this.");
                  }}
                  onStop={() => {
                    if (store.session) setConfirmEnd(true);
                    else setBreakEnd(null);
                  }}
                />
              }
            />
          ) : null}

          {view === "schedule" ? (
            <Schedule
              day={selectedDay}
              setDay={setSelectedDay}
              routines={store.routines}
              today={today}
              completions={store.completions}
              onToggle={(id) => store.toggleCompletion(`${today}:${id}`)}
              onEdit={setEditor}
              onAdd={() => setEditor(blankRoutine(selectedDay))}
            />
          ) : null}

          {view === "focus" ? (
            <div className="grid gap-4 lg:grid-cols-[1.4fr_0.8fr]">
              <FocusCard
                mode={mode}
                setMode={setMode}
                duration={duration}
                setDuration={setDuration}
                custom={custom}
                setCustom={setCustom}
                subject={subject}
                setSubject={setSubject}
                session={store.session}
                breakEnd={breakEnd}
                now={now}
                sound={sound}
                volume={volume}
                onVolume={changeVolume}
                onPlay={(kind) => void play(kind)}
                onStart={() => {
                  if (mode === "break") {
                    setBreakEnd(Date.now() + 5 * 60_000);
                    return;
                  }
                  store.startSession(subject, duration);
                  setToast("One small step. You’ve got this.");
                }}
                onStop={() => {
                  if (store.session) setConfirmEnd(true);
                  else setBreakEnd(null);
                }}
              />
              <SoundPicker sound={sound} onPlay={(kind) => void play(kind)} compact />
            </div>
          ) : null}

          {view === "tasks" ? (
            <Tasks
              assignments={store.assignments}
              exams={store.exams}
              notes={store.notes}
              onToggle={store.toggleAssignment}
              onEditAssignment={setAssignment}
              onEditExam={setExam}
              onEditNote={setNote}
              onNewAssignment={() => setAssignment(blankAssignment())}
              onNewExam={() => setExam(blankExam())}
              onNewNote={() => setNote(blankNote())}
            />
          ) : null}

          {view === "sounds" ? (
            <section className="rounded-card border border-line bg-surface p-5">
              <SoundPicker sound={sound} onPlay={(kind) => void play(kind)} />
              <label className="mt-6 flex items-center gap-3 text-sm text-muted">
                Volume
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={volume}
                  className="flex-1 accent-sage"
                  onChange={(e) => changeVolume(Number(e.target.value))}
                />
              </label>
            </section>
          ) : null}

          {view === "progress" ? (
            <Progress weekly={weekly} history={store.history} streak={streak} goal={store.preferences.dailyGoal} />
          ) : null}
        </main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-6 border-t border-line bg-surface md:hidden">
        {NAV.map((item) => {
          const Icon = item.icon;
          const active = view === item.id;
          return (
            <button key={item.id} type="button" onClick={() => go(item.id)} className={`flex flex-col items-center gap-1 py-2 text-[11px] ${active ? "text-sage" : "text-muted"}`}>
              <Icon size={18} />
              {item.label}
            </button>
          );
        })}
      </nav>

      {toast ? (
        <div className="fixed bottom-20 left-1/2 z-40 -translate-x-1/2 rounded-2xl bg-sage-deep px-4 py-3 text-sm text-white shadow-lg md:bottom-6">
          {toast}
        </div>
      ) : null}

      {editor ? (
        <RoutineDialog
          routine={editor}
          onClose={() => setEditor(null)}
          onSave={(next) => {
            if (next.end <= next.start) {
              setToast("End time must be later than start time.");
              return;
            }
            store.upsertRoutine(next);
            setEditor(null);
            setToast("Your study block is saved.");
          }}
          onDelete={() => {
            store.removeRoutine(editor.id);
            setEditor(null);
            setToast("Study block removed.");
          }}
        />
      ) : null}

      {assignment ? (
        <AssignmentDialog
          item={assignment}
          onClose={() => setAssignment(null)}
          onSave={(next) => {
            store.upsertAssignment(next);
            setAssignment(null);
            setToast("Assignment saved.");
          }}
          onDelete={() => {
            store.removeAssignment(assignment.id);
            setAssignment(null);
          }}
        />
      ) : null}

      {exam ? (
        <ExamDialog
          item={exam}
          onClose={() => setExam(null)}
          onSave={(next) => {
            store.upsertExam(next);
            setExam(null);
            setToast("Exam saved.");
          }}
          onDelete={() => {
            store.removeExam(exam.id);
            setExam(null);
          }}
        />
      ) : null}

      {note ? (
        <NoteDialog
          item={note}
          onClose={() => setNote(null)}
          onSave={(next) => {
            store.upsertNote({ ...next, updatedAt: Date.now() });
            setNote(null);
            setToast("Note saved.");
          }}
          onDelete={() => {
            store.removeNote(note.id);
            setNote(null);
          }}
        />
      ) : null}

      {settings ? (
        <SettingsDialog
          name={store.preferences.name}
          goal={store.preferences.dailyGoal}
          onClose={() => setSettings(false)}
          onSave={(name, dailyGoal) => {
            store.setPreferences({ name: name.slice(0, 40), dailyGoal });
            setSettings(false);
            setToast("Settings saved on this device.");
          }}
        />
      ) : null}

      {confirmEnd ? (
        <Modal title="End this focus session?" onClose={() => setConfirmEnd(false)}>
          <p className="text-sm leading-relaxed text-muted">The minutes you’ve already focused will be saved. Begin again whenever you’re ready.</p>
          <div className="mt-5 flex justify-end gap-2">
            <button type="button" className="h-11 rounded-xl bg-sage-soft px-4 text-sm font-medium text-sage" onClick={() => setConfirmEnd(false)}>
              Continue focusing
            </button>
            <button
              type="button"
              className="h-11 rounded-xl bg-sage px-4 text-sm font-semibold text-white"
              onClick={() => {
                store.endSession(false);
                setConfirmEnd(false);
                setToast("Every bit of focus counts.");
              }}
            >
              End & save
            </button>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}

function Goal({ minutes, goal }: { minutes: number; goal: number }) {
  const pct = Math.min(100, (minutes / Math.max(goal, 1)) * 100);
  return (
    <div className="min-w-48 rounded-2xl border border-line bg-surface px-4 py-3">
      <p className="text-xs font-semibold tracking-widest text-muted">DAILY INTENTION</p>
      <p className="mt-1 font-display text-2xl font-semibold">
        {Math.round(minutes)} <span className="text-sm font-normal text-muted">/ {goal} min</span>
      </p>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-sage-soft">
        <div className="h-full rounded-full bg-sage" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function Today({
  routines,
  date,
  today,
  completions,
  assignments,
  exams,
  totalToday,
  goal,
  streak,
  finished,
  hasAny,
  focus,
  onToggle,
  onEdit,
  onAdd,
  onStarter,
  onOpenSchedule,
  onOpenTasks,
}: {
  routines: Routine[];
  date: Date;
  today: string;
  completions: string[];
  assignments: Assignment[];
  exams: Exam[];
  totalToday: number;
  goal: number;
  streak: number;
  finished: number;
  hasAny: boolean;
  focus: ReactNode;
  onToggle: (id: string) => void;
  onEdit: (r: Routine) => void;
  onAdd: () => void;
  onStarter: () => void;
  onOpenSchedule: (day: number) => void;
  onOpenTasks: () => void;
}) {
  const upcoming = [...assignments].filter((a) => !a.completed).sort((a, b) => a.due.localeCompare(b.due)).slice(0, 2);
  const nextExam = [...exams].sort((a, b) => a.date.localeCompare(b.date))[0];
  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-[1.35fr_0.9fr]">
        {focus}
        <section className="rounded-card border border-line bg-surface p-5">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold tracking-widest text-muted">YOUR PLAN</p>
              <h2 className="text-lg font-bold">Today’s schedule</h2>
            </div>
            <button type="button" className="inline-flex h-10 items-center gap-1 rounded-xl bg-sage-soft px-3 text-sm font-medium text-sage" onClick={onAdd}>
              <Plus size={16} /> Add
            </button>
          </div>
          <div className="mb-3 grid grid-cols-7 gap-1">
            {[1, 2, 3, 4, 5, 6, 0].map((d) => (
              <button key={d} type="button" onClick={() => onOpenSchedule(d)} className={`rounded-lg py-2 text-center text-xs ${d === date.getDay() ? "bg-sage text-white" : "bg-bg text-muted"}`}>
                {DAYS[d].slice(0, 1)}
              </button>
            ))}
          </div>
          {routines.length ? (
            <div className="divide-y divide-line">
              {routines.slice(0, 4).map((r) => (
                <RoutineRow key={r.id} routine={r} done={completions.includes(`${today}:${r.id}`)} active={routineActive(r, date)} onToggle={() => onToggle(r.id)} onEdit={() => onEdit(r)} />
              ))}
            </div>
          ) : (
            <div className="py-6 text-center">
              <h3 className="font-semibold">Make room for one thing.</h3>
              <p className="mx-auto mt-1 max-w-xs text-sm text-muted">
                {hasAny ? "Nothing planned for today. Add a block whenever you’re ready." : "A subject. A time. A small commitment to yourself."}
              </p>
              <button type="button" className="mt-4 h-11 rounded-xl bg-sage-soft px-4 text-sm font-medium text-sage" onClick={onAdd}>
                Add your first block
              </button>
              {!hasAny ? (
                <button type="button" className="mt-2 block w-full text-sm text-sage underline" onClick={onStarter}>
                  Or try a weekday routine
                </button>
              ) : null}
            </div>
          )}
        </section>
      </div>

      <section className="rounded-card border border-line bg-surface p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold">Coming up</h2>
          <button type="button" className="text-sm font-medium text-sage" onClick={onOpenTasks}>
            Open tasks
          </button>
        </div>
        {upcoming.length === 0 && !nextExam ? (
          <p className="text-sm text-muted">No deadlines yet. Add an assignment or exam when one appears.</p>
        ) : (
          <div className="grid gap-2 md:grid-cols-3">
            {upcoming.map((a) => (
              <div key={a.id} className="rounded-xl bg-bg px-3 py-3">
                <p className="text-sm font-semibold">{a.title}</p>
                <p className="text-xs text-muted">{a.subject}</p>
                <p className={`mt-2 text-xs font-semibold ${daysUntil(a.due) < 0 ? "text-peach" : "text-sage"}`}>{dueLabel(daysUntil(a.due), a.completed)}</p>
              </div>
            ))}
            {nextExam ? (
              <div className="rounded-xl bg-peach-soft px-3 py-3">
                <p className="text-sm font-semibold">{nextExam.title}</p>
                <p className="text-xs text-muted">{nextExam.subject}</p>
                <p className="mt-2 text-xs font-semibold text-peach">{dueLabel(daysUntil(nextExam.date), false).replace("Due ", "")}</p>
              </div>
            ) : null}
          </div>
        )}
      </section>

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat icon={<Clock3 size={18} />} label="Focused today" value={`${Math.round(totalToday)}`} hint={`/ ${goal} min`} />
        <Stat icon={<Flame size={18} />} label="Current streak" value={`${streak}`} hint={streak === 1 ? "day" : "days"} />
        <Stat icon={<CheckCircle2 size={18} />} label="Blocks completed" value={`${finished}`} hint={`/ ${routines.length} today`} />
      </div>
    </div>
  );
}

function Stat({ icon, label, value, hint }: { icon: ReactNode; label: string; value: string; hint: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-4">
      <span className="grid size-10 place-items-center rounded-xl bg-sage-soft text-sage">{icon}</span>
      <div>
        <p className="text-xs text-muted">{label}</p>
        <p className="font-display text-2xl font-semibold">
          {value} <span className="text-sm font-normal text-muted">{hint}</span>
        </p>
      </div>
    </div>
  );
}

function RoutineRow({ routine, done, active, onToggle, onEdit }: { routine: Routine; done: boolean; active: boolean; onToggle: () => void; onEdit: () => void }) {
  return (
    <div className={`flex items-center gap-3 py-3 ${done ? "opacity-60" : ""}`}>
      <button type="button" aria-label={done ? `Unmark ${routine.subject}` : `Complete ${routine.subject}`} onClick={onToggle} className={`grid size-9 place-items-center rounded-lg border ${done ? "border-sage bg-sage-soft text-sage" : "border-line"}`}>
        {done ? <Check size={16} /> : <BookOpen size={16} />}
      </button>
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold">{routine.subject}</p>
        <p className="text-xs text-muted">
          {timeLabel(routine.start)} – {timeLabel(routine.end)}
        </p>
      </div>
      {active && !done ? <span className="rounded-full bg-sage-soft px-2 py-1 text-xs font-semibold text-sage">Now</span> : null}
      <button type="button" aria-label={`Edit ${routine.subject}`} className="grid size-9 place-items-center rounded-lg text-muted" onClick={onEdit}>
        <Pencil size={15} />
      </button>
    </div>
  );
}

function Schedule({
  day,
  setDay,
  routines,
  today,
  completions,
  onToggle,
  onEdit,
  onAdd,
}: {
  day: number;
  setDay: (d: number) => void;
  routines: Routine[];
  today: string;
  completions: string[];
  onToggle: (id: string) => void;
  onEdit: (r: Routine) => void;
  onAdd: () => void;
}) {
  const list = routines.filter((r) => r.days.includes(day)).sort((a, b) => a.start.localeCompare(b.start));
  return (
    <section className="rounded-card border border-line bg-surface p-5">
      <div className="mb-4 flex flex-wrap gap-2">
        {DAYS.map((label, i) => (
          <button key={label} type="button" onClick={() => setDay(i)} className={`h-11 min-w-12 rounded-xl px-3 text-sm font-medium ${i === day ? "bg-sage text-white" : "bg-bg text-muted"}`}>
            {label}
          </button>
        ))}
      </div>
      <h2 className="mb-2 text-lg font-bold">{DAYS[day]}’s blocks</h2>
      {list.length ? (
        <div className="divide-y divide-line">
          {list.map((r) => (
            <RoutineRow key={r.id} routine={r} done={completions.includes(`${today}:${r.id}`)} active={false} onToggle={() => onToggle(r.id)} onEdit={() => onEdit(r)} />
          ))}
        </div>
      ) : (
        <div className="py-10 text-center">
          <h3 className="font-semibold">Nothing planned yet.</h3>
          <p className="mt-1 text-sm text-muted">Add a study block for this day.</p>
          <button type="button" className="mt-4 h-11 rounded-xl bg-sage px-4 text-sm font-semibold text-white" onClick={onAdd}>
            Add block
          </button>
        </div>
      )}
    </section>
  );
}

function FocusCard({
  mode,
  setMode,
  duration,
  setDuration,
  custom,
  setCustom,
  subject,
  setSubject,
  session,
  breakEnd,
  now,
  sound,
  volume,
  onVolume,
  onPlay,
  onStart,
  onStop,
}: {
  mode: "focus" | "break";
  setMode: (m: "focus" | "break") => void;
  duration: number;
  setDuration: (n: number) => void;
  custom: boolean;
  setCustom: (v: boolean) => void;
  subject: string;
  setSubject: (s: string) => void;
  session: { subject: string; endsAt: number; duration: number } | null;
  breakEnd: number | null;
  now: number;
  sound: SoundKind | null;
  volume: number;
  onVolume: (n: number) => void;
  onPlay: (k: SoundKind) => void;
  onStart: () => void;
  onStop: () => void;
}) {
  const running = mode === "break" ? breakEnd : session?.endsAt;
  const total = mode === "break" ? 300 : (session?.duration || duration) * 60;
  const seconds = running ? Math.max(0, Math.ceil((running - now) / 1000)) : total;
  const clock = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
  const pct = total ? Math.max(0, Math.min(100, (1 - seconds / total) * 100)) : 0;
  const active = Boolean(session || (mode === "break" && breakEnd));
  return (
    <section className="rounded-card border border-line bg-surface p-5 md:p-7">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-lg font-bold">
          <span className="grid size-9 place-items-center rounded-xl bg-sage-soft text-sage">
            <Timer size={18} />
          </span>
          Focus session
        </h2>
        <div className="flex rounded-xl bg-bg p-1">
          <button type="button" disabled={Boolean(breakEnd)} className={`h-9 rounded-lg px-3 text-sm ${mode === "focus" ? "bg-surface font-semibold" : "text-muted"}`} onClick={() => setMode("focus")}>
            Focus
          </button>
          <button type="button" disabled={Boolean(session)} className={`h-9 rounded-lg px-3 text-sm ${mode === "break" ? "bg-surface font-semibold" : "text-muted"}`} onClick={() => setMode("break")}>
            Break
          </button>
        </div>
      </div>
      {!session && mode === "focus" ? (
        <label className="mt-5 block text-xs font-semibold tracking-widest text-muted">
          WHAT ARE YOU WORKING ON?
          <span className="mt-2 flex h-12 items-center gap-2 rounded-xl border border-line bg-bg px-3">
            <BookOpen size={16} />
            <input value={subject} maxLength={80} onChange={(e) => setSubject(e.target.value)} className="w-full bg-transparent text-sm font-medium tracking-normal text-ink outline-none" placeholder="Choose one thing" />
          </span>
        </label>
      ) : (
        <p className="mt-5 flex items-center gap-2 text-sm font-medium">
          <BookOpen size={16} /> {session?.subject || "A five-minute breather"}
        </p>
      )}
      <div className="mx-auto my-6 grid size-56 place-items-center rounded-full p-2 timer-ring" style={{ ["--p" as string]: `${active ? pct : 0}%` }}>
        <div className="grid size-full place-items-center rounded-full bg-surface text-center">
          <div>
            <p className="font-display text-5xl font-semibold tracking-tight">{clock}</p>
            <p className="mt-1 px-6 text-xs text-muted">{session ? "You’re making time for what matters." : mode === "break" ? "Rest your eyes. Relax your shoulders." : "A little focus goes a long way."}</p>
          </div>
        </div>
      </div>
      {!session && mode === "focus" ? (
        <div className="mb-4 flex flex-wrap justify-center gap-2">
          {[25, 45, 60].map((m) => (
            <button key={m} type="button" className={`h-10 rounded-xl px-3 text-sm ${!custom && duration === m ? "bg-sage text-white" : "bg-bg text-muted"}`} onClick={() => { setCustom(false); setDuration(m); }}>
              {m} min
            </button>
          ))}
          <button type="button" className={`h-10 rounded-xl px-3 text-sm ${custom ? "bg-sage text-white" : "bg-bg text-muted"}`} onClick={() => setCustom(!custom)}>
            Custom
          </button>
          {custom ? (
            <label className="flex h-10 items-center gap-1 rounded-xl bg-bg px-2 text-sm">
              <input type="number" min={1} max={180} value={duration} aria-label="Custom focus minutes" className="w-14 bg-transparent text-center outline-none" onChange={(e) => setDuration(Math.max(1, Math.min(180, Number(e.target.value) || 1)))} />
              min
            </label>
          ) : null}
        </div>
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          {(["rain", "stream", "piano"] as const).map((kind) => (
            <button key={kind} type="button" onClick={() => onPlay(kind)} className={`h-10 rounded-xl px-3 text-sm capitalize ${sound === kind ? "bg-sage text-white" : "bg-bg text-muted"}`}>
              {kind}
            </button>
          ))}
        </div>
        <input aria-label="Sound volume" type="range" min={0} max={1} step={0.01} value={volume} className="w-24 accent-sage" onChange={(e) => onVolume(Number(e.target.value))} />
      </div>
      <button type="button" onClick={active ? onStop : onStart} className="mt-5 h-12 w-full rounded-xl bg-sage text-sm font-semibold text-white">
        {active ? "End session" : mode === "break" ? "Start a 5-minute break" : "Start focus"}
      </button>
    </section>
  );
}

function SoundPicker({ sound, onPlay, compact = false }: { sound: SoundKind | null; onPlay: (k: SoundKind) => void; compact?: boolean }) {
  const items: { id: SoundKind; title: string; copy: string }[] = [
    { id: "rain", title: "Rain", copy: "A steady hush for deep work." },
    { id: "stream", title: "Stream", copy: "Soft water, never in a hurry." },
    { id: "piano", title: "Piano", copy: "A few quiet notes, far apart." },
  ];
  return (
    <div className={`grid gap-3 ${compact ? "" : "sm:grid-cols-3"}`}>
      {items.map((item) => (
        <button key={item.id} type="button" onClick={() => onPlay(item.id)} className={`rounded-2xl border p-4 text-left ${sound === item.id ? "border-sage bg-sage-soft" : "border-line bg-bg"}`}>
          <Headphones size={18} className="text-sage" />
          <p className="mt-3 font-semibold">{item.title}</p>
          <p className="mt-1 text-sm text-muted">{item.copy}</p>
          <p className="mt-3 text-xs font-semibold text-sage">{sound === item.id ? "Playing" : "Play"}</p>
        </button>
      ))}
    </div>
  );
}

function Tasks({
  assignments,
  exams,
  notes,
  onToggle,
  onEditAssignment,
  onEditExam,
  onEditNote,
  onNewAssignment,
  onNewExam,
  onNewNote,
}: {
  assignments: Assignment[];
  exams: Exam[];
  notes: Note[];
  onToggle: (id: string) => void;
  onEditAssignment: (a: Assignment) => void;
  onEditExam: (e: Exam) => void;
  onEditNote: (n: Note) => void;
  onNewAssignment: () => void;
  onNewExam: () => void;
  onNewNote: () => void;
}) {
  const sortedA = [...assignments].sort((a, b) => Number(a.completed) - Number(b.completed) || a.due.localeCompare(b.due));
  const sortedE = [...exams].sort((a, b) => a.date.localeCompare(b.date));
  const sortedN = [...notes].sort((a, b) => b.updatedAt - a.updatedAt);
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Panel title="Assignments" eyebrow="DEADLINES" action="Add" onAction={onNewAssignment}>
        {sortedA.length === 0 ? <Empty title="No deadlines yet." copy="Add an assignment so nothing sneaks up on you." /> : sortedA.map((a) => {
          const days = daysUntil(a.due);
          return (
            <div key={a.id} className="flex items-center gap-2 border-t border-line py-3">
              <button type="button" aria-label={`Toggle ${a.title}`} onClick={() => onToggle(a.id)} className={`grid size-9 place-items-center rounded-lg border ${a.completed ? "border-sage bg-sage-soft text-sage" : "border-line"}`}>
                {a.completed ? <Check size={16} /> : <BookOpen size={16} />}
              </button>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{a.title}</p>
                <p className="text-xs text-muted">{a.subject} · {a.priority}</p>
              </div>
              <span className={`text-xs font-semibold ${days < 0 && !a.completed ? "text-peach" : "text-sage"}`}>{dueLabel(days, a.completed)}</span>
              <button type="button" aria-label="Edit assignment" onClick={() => onEditAssignment(a)} className="grid size-9 place-items-center text-muted"><Pencil size={15} /></button>
            </div>
          );
        })}
      </Panel>
      <Panel title="Exams" eyebrow="UPCOMING" action="Add" onAction={onNewExam}>
        {sortedE.length === 0 ? <Empty title="No exams scheduled." copy="Add one so you can plan revision with calm." /> : sortedE.map((e) => {
          const days = daysUntil(e.date);
          return (
            <div key={e.id} className="flex items-center gap-2 border-t border-line py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{e.title}</p>
                <p className="text-xs text-muted">{e.subject}</p>
              </div>
              <span className={`text-xs font-semibold ${days < 0 ? "text-muted" : days <= 7 ? "text-peach" : "text-sage"}`}>
                {days < 0 ? "Passed" : days === 0 ? "Today" : days === 1 ? "Tomorrow" : `${days} days`}
              </span>
              <button type="button" aria-label="Edit exam" onClick={() => onEditExam(e)} className="grid size-9 place-items-center text-muted"><Pencil size={15} /></button>
            </div>
          );
        })}
      </Panel>
      <Panel title="Notes" eyebrow="CAPTURE" action="New" onAction={onNewNote}>
        {sortedN.length === 0 ? <Empty title="A quiet place for ideas." copy="Jot down a thought, formula, or reminder." /> : sortedN.map((n) => (
          <button key={n.id} type="button" onClick={() => onEditNote(n)} className="block w-full border-t border-line py-3 text-left">
            <p className="truncate font-semibold">{n.title || "Untitled"}</p>
            <p className="truncate text-xs text-muted">{n.subject || "General"} · {new Date(n.updatedAt).toLocaleDateString()}</p>
          </button>
        ))}
      </Panel>
    </div>
  );
}

function Panel({ title, eyebrow, action, onAction, children }: { title: string; eyebrow: string; action: string; onAction: () => void; children: ReactNode }) {
  return (
    <section className="rounded-card border border-line bg-surface p-5">
      <div className="mb-2 flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold tracking-widest text-muted">{eyebrow}</p>
          <h2 className="text-lg font-bold">{title}</h2>
        </div>
        <button type="button" onClick={onAction} className="inline-flex h-10 items-center gap-1 rounded-xl bg-sage-soft px-3 text-sm font-medium text-sage">
          <Plus size={15} /> {action}
        </button>
      </div>
      {children}
    </section>
  );
}

function Empty({ title, copy }: { title: string; copy: string }) {
  return (
    <div className="py-6 text-center">
      <h3 className="font-semibold">{title}</h3>
      <p className="mt-1 text-sm text-muted">{copy}</p>
    </div>
  );
}

function Progress({ weekly, history, streak, goal }: { weekly: { label: string; minutes: number; key: string }[]; history: { id: string; subject: string; minutes: number; endedAt: number; completed: boolean }[]; streak: number; goal: number }) {
  const weekTotal = weekly.reduce((s, d) => s + d.minutes, 0);
  const max = Math.max(goal, ...weekly.map((d) => d.minutes), 1);
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat icon={<Clock3 size={18} />} label="This week" value={`${Math.round(weekTotal)}`} hint="min" />
        <Stat icon={<Flame size={18} />} label="Current streak" value={`${streak}`} hint={streak === 1 ? "day" : "days"} />
        <Stat icon={<CheckCircle2 size={18} />} label="Sessions" value={`${history.length}`} hint="total" />
      </div>
      <section className="rounded-card border border-line bg-surface p-5">
        <h2 className="mb-4 text-lg font-bold">This week</h2>
        <div className="flex h-48 items-end gap-3">
          {weekly.map((d) => (
            <div key={d.key} className="flex flex-1 flex-col items-center gap-2">
              <div className="flex h-36 w-full items-end rounded-t-lg bg-sage-soft">
                <div className="w-full rounded-t-lg bg-leaf" style={{ height: `${(d.minutes / max) * 100}%` }} />
              </div>
              <span className="text-xs text-muted">{d.label}</span>
            </div>
          ))}
        </div>
      </section>
      <section className="rounded-card border border-line bg-surface p-5">
        <h2 className="mb-2 text-lg font-bold">Recent sessions</h2>
        {history.length === 0 ? <p className="text-sm text-muted">Your finished sessions will gather here.</p> : history.slice(-8).reverse().map((h) => (
          <div key={h.id} className="flex items-center justify-between border-t border-line py-3 text-sm">
            <div>
              <p className="font-semibold">{h.subject}</p>
              <p className="text-xs text-muted">{new Date(h.endedAt).toLocaleDateString()} · {h.completed ? "Completed" : "Ended"}</p>
            </div>
            <p className="font-medium">{Math.round(h.minutes)} min</p>
          </div>
        ))}
      </section>
    </div>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-end bg-ink/40 p-4 sm:place-items-center" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={title} className="max-h-[90vh] w-full max-w-lg overflow-auto rounded-3xl bg-surface p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold">{title}</h2>
          <button type="button" aria-label="Close" className="grid size-10 place-items-center rounded-xl text-muted" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="mb-3 block text-sm font-medium">
      {label}
      <div className="mt-1">{children}</div>
    </label>
  );
}

const inputClass = "h-11 w-full rounded-xl border border-line bg-bg px-3 text-sm outline-none focus:border-sage";

function RoutineDialog({ routine, onClose, onSave, onDelete }: { routine: Routine; onClose: () => void; onSave: (r: Routine) => void; onDelete: () => void }) {
  const [draft, setDraft] = useState(routine);
  const existing = routine.subject.length > 0;
  return (
    <Modal title={existing ? "Edit study block" : "New study block"} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!draft.subject.trim() || draft.days.length === 0) return;
          onSave({ ...draft, subject: draft.subject.trim() });
        }}
      >
        <Field label="Subject">
          <input required maxLength={80} className={inputClass} value={draft.subject} onChange={(e) => setDraft({ ...draft, subject: e.target.value })} />
        </Field>
        <Field label="Note">
          <input maxLength={200} className={inputClass} value={draft.note} onChange={(e) => setDraft({ ...draft, note: e.target.value })} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Start">
            <input type="time" required className={inputClass} value={draft.start} onChange={(e) => setDraft({ ...draft, start: e.target.value })} />
          </Field>
          <Field label="End">
            <input type="time" required className={inputClass} value={draft.end} onChange={(e) => setDraft({ ...draft, end: e.target.value })} />
          </Field>
        </div>
        <p className="mb-2 text-sm font-medium">Days</p>
        <div className="mb-4 flex flex-wrap gap-2">
          {DAYS.map((label, i) => {
            const on = draft.days.includes(i);
            return (
              <button
                key={label}
                type="button"
                className={`h-10 min-w-11 rounded-lg px-2 text-sm ${on ? "bg-sage text-white" : "bg-bg text-muted"}`}
                onClick={() => setDraft({ ...draft, days: on ? draft.days.filter((d) => d !== i) : [...draft.days, i].sort() })}
              >
                {label}
              </button>
            );
          })}
        </div>
        <DialogActions existing={existing} onDelete={onDelete} />
      </form>
    </Modal>
  );
}

function AssignmentDialog({ item, onClose, onSave, onDelete }: { item: Assignment; onClose: () => void; onSave: (a: Assignment) => void; onDelete: () => void }) {
  const [draft, setDraft] = useState(item);
  return (
    <Modal title={item.title ? "Edit assignment" : "New assignment"} onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); onSave({ ...draft, title: draft.title.trim(), subject: draft.subject.trim() }); }}>
        <Field label="Title"><input required maxLength={120} className={inputClass} value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} /></Field>
        <Field label="Subject / course"><input required maxLength={80} className={inputClass} value={draft.subject} onChange={(e) => setDraft({ ...draft, subject: e.target.value })} /></Field>
        <Field label="Due date"><input type="date" required className={inputClass} value={draft.due} onChange={(e) => setDraft({ ...draft, due: e.target.value })} /></Field>
        <Field label="Priority">
          <select className={inputClass} value={draft.priority} onChange={(e) => setDraft({ ...draft, priority: e.target.value as Assignment["priority"] })}>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </Field>
        <Field label="Note"><textarea maxLength={300} className="w-full rounded-xl border border-line bg-bg p-3 text-sm outline-none" rows={3} value={draft.note} onChange={(e) => setDraft({ ...draft, note: e.target.value })} /></Field>
        <DialogActions existing={Boolean(item.title)} onDelete={onDelete} />
      </form>
    </Modal>
  );
}

function ExamDialog({ item, onClose, onSave, onDelete }: { item: Exam; onClose: () => void; onSave: (e: Exam) => void; onDelete: () => void }) {
  const [draft, setDraft] = useState(item);
  return (
    <Modal title={item.title ? "Edit exam" : "New exam"} onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); onSave({ ...draft, title: draft.title.trim(), subject: draft.subject.trim() }); }}>
        <Field label="Title"><input required maxLength={120} className={inputClass} value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} /></Field>
        <Field label="Subject"><input required maxLength={80} className={inputClass} value={draft.subject} onChange={(e) => setDraft({ ...draft, subject: e.target.value })} /></Field>
        <Field label="Date"><input type="date" required className={inputClass} value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} /></Field>
        <Field label="Note"><textarea maxLength={300} className="w-full rounded-xl border border-line bg-bg p-3 text-sm outline-none" rows={3} value={draft.note} onChange={(e) => setDraft({ ...draft, note: e.target.value })} /></Field>
        <DialogActions existing={Boolean(item.title)} onDelete={onDelete} />
      </form>
    </Modal>
  );
}

function NoteDialog({ item, onClose, onSave, onDelete }: { item: Note; onClose: () => void; onSave: (n: Note) => void; onDelete: () => void }) {
  const [draft, setDraft] = useState(item);
  return (
    <Modal title={item.title ? "Edit note" : "New note"} onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); onSave({ ...draft, title: draft.title.trim() }); }}>
        <Field label="Title"><input required maxLength={100} className={inputClass} value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} /></Field>
        <Field label="Subject"><input maxLength={80} className={inputClass} value={draft.subject} onChange={(e) => setDraft({ ...draft, subject: e.target.value })} /></Field>
        <Field label="Content"><textarea required maxLength={2000} className="w-full rounded-xl border border-line bg-bg p-3 text-sm outline-none" rows={7} value={draft.content} onChange={(e) => setDraft({ ...draft, content: e.target.value })} /></Field>
        <DialogActions existing={Boolean(item.title)} onDelete={onDelete} />
      </form>
    </Modal>
  );
}

function SettingsDialog({ name, goal, onClose, onSave }: { name: string; goal: number; onClose: () => void; onSave: (name: string, goal: number) => void }) {
  const [draftName, setDraftName] = useState(name);
  const [draftGoal, setDraftGoal] = useState(goal);
  return (
    <Modal title="Your space" onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); onSave(draftName.trim(), Math.max(15, Math.min(720, draftGoal))); }}>
        <Field label="What should we call you?">
          <input maxLength={40} className={inputClass} value={draftName} onChange={(e) => setDraftName(e.target.value)} placeholder="Your name" />
        </Field>
        <Field label="Daily intention (minutes)">
          <input type="number" min={15} max={720} className={inputClass} value={draftGoal} onChange={(e) => setDraftGoal(Number(e.target.value) || 120)} />
        </Field>
        <p className="mb-4 text-xs leading-relaxed text-muted">Routines, focus time, deadlines, and notes stay on this device. Clearing site data starts a fresh space.</p>
        <button type="submit" className="h-11 w-full rounded-xl bg-sage text-sm font-semibold text-white">Save</button>
      </form>
    </Modal>
  );
}

function DialogActions({ existing, onDelete }: { existing: boolean; onDelete: () => void }) {
  return (
    <div className="mt-2 flex justify-between gap-2">
      {existing ? (
        <button type="button" onClick={onDelete} className="inline-flex h-11 items-center gap-1 rounded-xl px-3 text-sm text-peach">
          <Trash2 size={15} /> Delete
        </button>
      ) : <span />}
      <button type="submit" className="h-11 rounded-xl bg-sage px-5 text-sm font-semibold text-white">Save</button>
    </div>
  );
}

function blankRoutine(day: number): Routine {
  return { id: crypto.randomUUID(), subject: "", note: "", start: "09:00", end: "10:00", days: [day], enabled: true, color: "sage" };
}
function blankAssignment(): Assignment {
  return { id: crypto.randomUUID(), title: "", subject: "", due: dayKey(), priority: "medium", completed: false, note: "", color: "peach" };
}
function blankExam(): Exam {
  return { id: crypto.randomUUID(), title: "", subject: "", date: dayKey(), note: "", color: "sage" };
}
function blankNote(): Note {
  return { id: crypto.randomUUID(), title: "", content: "", subject: "", updatedAt: Date.now() };
}
