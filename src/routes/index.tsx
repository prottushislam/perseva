import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  BookOpen,
  CalendarDays,
  Check,
  Clock3,
  Flame,
  Headphones,
  LayoutDashboard,
  Menu,
  Pencil,
  Plus,
  Settings2,
  Timer,
  Trash2,
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
import { Ambience, SOUNDS, type SoundId } from "@/lib/soundscape";

export const Route = createFileRoute("/")({ component: Home });

type View = "today" | "focus" | "plan" | "sound" | "progress";
type PlanTab = "week" | "due" | "notes";

const NAV: { id: View; label: string; icon: typeof LayoutDashboard }[] = [
  { id: "today", label: "Today", icon: LayoutDashboard },
  { id: "focus", label: "Focus", icon: Timer },
  { id: "plan", label: "Plan", icon: CalendarDays },
  { id: "sound", label: "Sound", icon: Headphones },
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
  const [planTab, setPlanTab] = useState<PlanTab>("week");
  const [duration, setDuration] = useState(25);
  const [custom, setCustom] = useState(false);
  const [subject, setSubject] = useState("Deep work");
  const [mode, setMode] = useState<"focus" | "break">("focus");
  const [breakEnd, setBreakEnd] = useState<number | null>(null);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [sound, setSound] = useState<SoundId | null>(null);
  const [volume, setVolume] = useState(0.8);
  const audio = useRef<Ambience | null>(null);
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
    setToast("You showed up. That session is kept.");
    ending.current = false;
  }, [now, store]);

  useEffect(() => {
    if (breakEnd && breakEnd <= now) {
      setBreakEnd(null);
      setMode("focus");
      setToast("Break over. Another small step when you are ready.");
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
    const active = new Set(store.history.filter((h) => h.minutes >= 1).map((h) => dayKey(new Date(h.endedAt))));
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

  async function playSound(id: SoundId) {
    if (!audio.current) audio.current = new Ambience();
    if (sound === id) {
      audio.current.stop();
      setSound(null);
      return;
    }
    try {
      await audio.current.play(id, volume);
      setSound(id);
    } catch {
      setSound(null);
      setToast("The sound could not start. Tap again, and check your volume.");
    }
  }

  function changeVolume(value: number) {
    setVolume(value);
    audio.current?.volume(value);
  }

  const headings: Record<View, { title: string; copy: string }> = {
    today: {
      title: store.preferences.name ? `Good to see you, ${store.preferences.name}.` : "A little further, every day.",
      copy: "Today’s hours, what is due, and a quiet place to focus.",
    },
    focus: { title: "Stay with one thing.", copy: "Set the length. A sound can stay with you." },
    plan: { title: "The week and what is due.", copy: "Hours, deadlines, and the notes you want to keep." },
    sound: { title: "A quieter room.", copy: "Pick one. It keeps playing while you study." },
    progress: { title: "The time you have given.", copy: "A week, a streak, and the sessions you finished." },
  };

  const focusCard = (
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
      piano={sound}
      onOpenSound={() => go("sound")}
      onStopSound={() => {
        audio.current?.stop();
        setSound(null);
      }}
      onStart={() => {
        if (mode === "break") {
          setBreakEnd(Date.now() + 5 * 60_000);
          return;
        }
        store.startSession(subject, duration);
        if (!sound) void playSound("piano");
        setToast(sound ? "Session started." : "Piano is on. You can change it in Sound.");
      }}
      onStop={() => {
        if (store.session) setConfirmEnd(true);
        else setBreakEnd(null);
      }}
    />
  );

  return (
    <div className="min-h-screen bg-bg text-ink">
      <aside className={`${menu ? "fixed inset-y-0 left-0 z-30 flex" : "hidden"} w-60 flex-col border-r border-line bg-surface px-5 py-8 md:fixed md:flex`}>
        <button type="button" className="mb-10 px-2 text-left font-display text-3xl" onClick={() => go("today")}>
          Perseva
        </button>
        <nav className="flex flex-col gap-1">
          {NAV.map((item) => {
            const Icon = item.icon;
            const active = view === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => go(item.id)}
                className={`flex h-11 items-center gap-3 px-2 text-left text-sm ${active ? "border-l-2 border-ink pl-3 font-medium text-ink" : "text-muted"}`}
              >
                <Icon size={16} strokeWidth={1.5} />
                {item.label}
                {item.id === "focus" && store.session ? <span className="ml-auto size-1.5 rounded-full bg-accent" /> : null}
              </button>
            );
          })}
        </nav>
        <p className="mt-auto px-2 text-sm leading-relaxed text-muted">
          A little further, every day.
        </p>
      </aside>
      {menu ? <button type="button" aria-label="Close menu" className="fixed inset-0 z-20 bg-scrim/60 md:hidden" onClick={() => setMenu(false)} /> : null}

      <div className="md:pl-60">
        <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-line bg-bg/90 px-4 backdrop-blur md:px-8">
          <div className="flex items-center gap-3 text-sm text-muted">
            <button type="button" className="grid size-11 place-items-center md:hidden" aria-label="Open menu" onClick={() => setMenu(true)}>
              <Menu size={18} />
            </button>
            <span className="text-ink">{NAV.find((n) => n.id === view)?.label}</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="hidden text-sm text-muted sm:inline">
              {date.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}
            </span>
            <button type="button" aria-label="Settings" className="grid size-11 place-items-center text-muted" onClick={() => setSettings(true)}>
              {store.preferences.name ? <span className="font-display text-lg text-ink">{store.preferences.name[0].toUpperCase()}</span> : <Settings2 size={18} />}
            </button>
          </div>
        </header>

        <main className="mx-auto max-w-6xl px-4 py-8 pb-28 md:px-8 md:pb-12">
          <div className="mb-8 flex flex-wrap items-end justify-between gap-6">
            <div className="max-w-xl">
              <p className="text-sm text-muted">{date.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}</p>
              <h1 className="mt-2 text-[2.7rem] leading-[1.08] md:text-6xl">{headings[view].title}</h1>
              <p className="mt-3 text-muted">{headings[view].copy}</p>
            </div>
            {view === "today" ? <Goal minutes={totalToday} goal={store.preferences.dailyGoal} /> : null}
            {view === "plan" && planTab === "week" ? (
              <button type="button" className="h-11 bg-ink px-4 text-sm text-bg" onClick={() => setEditor(blankRoutine(selectedDay))}>
                Add a block
              </button>
            ) : null}
          </div>

          {!ready ? <p className="text-muted">Opening your space…</p> : null}

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
              focusing={Boolean(store.session)}
              onToggle={(id) => store.toggleCompletion(`${today}:${id}`)}
              onEdit={setEditor}
              onAdd={() => setEditor(blankRoutine(date.getDay()))}
              onStarter={() => {
                store.addStarter();
                setToast("A weekday plan is in place. Change it as you like.");
              }}
              onOpenFocus={() => go("focus")}
              onOpenSchedule={(day) => {
                setSelectedDay(day);
                setPlanTab("week");
                go("plan");
              }}
              onOpenTasks={() => {
                setPlanTab("due");
                go("plan");
              }}
            />
          ) : null}

          {view === "focus" ? <div className="mx-auto max-w-xl">{focusCard}</div> : null}

          {view === "plan" ? (
            <div className="space-y-6">
              <div className="grid grid-cols-3 border border-line bg-surface">
                {(
                  [
                    ["week", "Week"],
                    ["due", "Due"],
                    ["notes", "Notes"],
                  ] as const
                ).map(([id, label]) => (
                  <button key={id} type="button" onClick={() => setPlanTab(id)} className={`h-12 text-sm ${planTab === id ? "bg-ink text-bg" : "text-muted"}`}>
                    {label}
                  </button>
                ))}
              </div>
              {planTab === "week" ? (
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
              {planTab === "due" ? (
                <Tasks
                  part="due"
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
              {planTab === "notes" ? (
                <Tasks
                  part="notes"
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
            </div>
          ) : null}

          {view === "sound" ? (
            <SoundRoom
              current={sound}
              volume={volume}
              onVolume={changeVolume}
              onPlay={(id) => void playSound(id)}
            />
          ) : null}

          {view === "progress" ? <Progress weekly={weekly} history={store.history} streak={streak} goal={store.preferences.dailyGoal} /> : null}
        </main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 border-t border-line bg-surface md:hidden">
        {NAV.map((item) => {
          const Icon = item.icon;
          const active = view === item.id;
          return (
            <button key={item.id} type="button" onClick={() => go(item.id)} className={`flex min-h-16 flex-col items-center justify-center gap-1 text-xs ${active ? "text-ink" : "text-muted"}`}>
              <Icon size={18} strokeWidth={1.5} />
              {item.label}
            </button>
          );
        })}
      </nav>

      {toast ? <div className={`fixed left-1/2 z-40 -translate-x-1/2 bg-ink px-4 py-3 text-sm text-bg ${sound ? "bottom-32 md:bottom-20" : "bottom-20 md:bottom-6"}`}>{toast}</div> : null}

      {sound ? (
        <div className="fixed inset-x-0 bottom-16 z-30 flex items-center justify-between gap-3 border-t border-line bg-surface px-4 py-3 md:bottom-0 md:left-60">
          <p className="min-w-0 truncate text-sm">
            <span className="text-muted">Playing </span>
            {SOUNDS.find((item) => item.id === sound)?.title}
          </p>
          <button
            type="button"
            className="h-10 shrink-0 px-2 text-sm text-accent"
            onClick={() => {
              audio.current?.stop();
              setSound(null);
            }}
          >
            Stop
          </button>
        </div>
      ) : null}

      {editor ? (
        <RoutineDialog
          routine={editor}
          onClose={() => setEditor(null)}
          onSave={(next) => {
            if (next.end <= next.start) {
              setToast("End time must be later than the start.");
              return;
            }
            store.upsertRoutine(next);
            setEditor(null);
            setToast("Study block saved.");
          }}
          onDelete={() => {
            store.removeRoutine(editor.id);
            setEditor(null);
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
            setToast("Saved on this device.");
          }}
        />
      ) : null}
      {confirmEnd ? (
        <Modal title="End this session?" onClose={() => setConfirmEnd(false)}>
          <p className="text-sm leading-relaxed text-muted">The minutes you have already focused will be kept.</p>
          <div className="mt-6 flex justify-end gap-3">
            <button type="button" className="h-11 px-4 text-sm" onClick={() => setConfirmEnd(false)}>
              Keep going
            </button>
            <button
              type="button"
              className="h-11 bg-ink px-4 text-sm text-bg"
              onClick={() => {
                store.endSession(false);
                setConfirmEnd(false);
                setToast("Saved. Every bit counts.");
              }}
            >
              End and save
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
    <div className="min-w-52 border border-line bg-surface px-4 py-3">
      <p className="text-xs text-muted">Today</p>
      <p className="mt-1 font-display text-3xl tabular-nums">
        {Math.round(minutes)} <span className="text-base text-muted">/ {goal}</span>
      </p>
      <div className="mt-3 h-px bg-line">
        <div className="h-px bg-ink" style={{ width: `${pct}%` }} />
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
  focusing,
  onToggle,
  onEdit,
  onAdd,
  onStarter,
  onOpenFocus,
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
  focusing: boolean;
  onToggle: (id: string) => void;
  onEdit: (r: Routine) => void;
  onAdd: () => void;
  onStarter: () => void;
  onOpenFocus: () => void;
  onOpenSchedule: (day: number) => void;
  onOpenTasks: () => void;
}) {
  const upcoming = [...assignments].filter((a) => !a.completed).sort((a, b) => a.due.localeCompare(b.due)).slice(0, 2);
  const nextExam = [...exams].sort((a, b) => a.date.localeCompare(b.date))[0];
  return (
    <div className="space-y-6">
      <button type="button" onClick={onOpenFocus} className="flex w-full items-center justify-between border border-line bg-surface px-5 py-4 text-left">
        <span>
          <span className="block text-xs text-muted">Focus</span>
          <span className="mt-1 block font-display text-2xl">{focusing ? "A session is open" : "Start a quiet sitting"}</span>
        </span>
        <span className="text-sm text-accent">{focusing ? "Return" : "Open"}</span>
      </button>
      <section className="border border-line bg-surface p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-2xl">Today’s schedule</h2>
            <button type="button" className="inline-flex h-11 items-center gap-1 text-sm text-accent" onClick={onAdd}>
              <Plus size={15} /> Add
            </button>
          </div>
          <div className="mb-4 grid grid-cols-7 gap-1">
            {[1, 2, 3, 4, 5, 6, 0].map((d) => (
              <button key={d} type="button" onClick={() => onOpenSchedule(d)} className={`h-10 text-xs ${d === date.getDay() ? "bg-ink text-bg" : "text-muted"}`}>
                {DAYS[d].slice(0, 1)}
              </button>
            ))}
          </div>
          {routines.length ? (
            routines.slice(0, 4).map((r) => (
              <RoutineRow key={r.id} routine={r} done={completions.includes(`${today}:${r.id}`)} active={routineActive(r, date)} onToggle={() => onToggle(r.id)} onEdit={() => onEdit(r)} />
            ))
          ) : (
            <div className="py-8 text-center">
              <h3 className="text-xl">Nothing planned yet.</h3>
              <p className="mx-auto mt-2 max-w-xs text-sm text-muted">{hasAny ? "Today is open." : "A subject, a time, a small promise."}</p>
              <button type="button" className="mt-4 h-11 bg-ink px-4 text-sm text-bg" onClick={onAdd}>
                Add a block
              </button>
              {!hasAny ? (
                <button type="button" className="mt-3 block w-full text-sm text-accent" onClick={onStarter}>
                  Or try a weekday plan
                </button>
              ) : null}
            </div>
          )}
        </section>
      <section className="border border-line bg-surface p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-2xl">Coming up</h2>
          <button type="button" className="text-sm text-accent" onClick={onOpenTasks}>
            Open tasks
          </button>
        </div>
        {upcoming.length === 0 && !nextExam ? (
          <p className="text-sm text-muted">No deadlines yet.</p>
        ) : (
          <div className="grid gap-4 md:grid-cols-3">
            {upcoming.map((a) => (
              <div key={a.id}>
                <p className="font-medium">{a.title}</p>
                <p className="text-xs text-muted">{a.subject}</p>
                <p className={`mt-2 text-sm ${daysUntil(a.due) < 0 ? "text-accent" : "text-muted"}`}>{dueLabel(daysUntil(a.due), a.completed)}</p>
              </div>
            ))}
            {nextExam ? (
              <div>
                <p className="font-medium">{nextExam.title}</p>
                <p className="text-xs text-muted">Exam · {nextExam.subject}</p>
                <p className="mt-2 text-sm text-muted">{dueLabel(daysUntil(nextExam.date), false)}</p>
              </div>
            ) : null}
          </div>
        )}
      </section>
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat icon={<Clock3 size={16} />} label="Focused today" value={`${Math.round(totalToday)}`} hint={`/ ${goal} min`} />
        <Stat icon={<Flame size={16} />} label="Streak" value={`${streak}`} hint={streak === 1 ? "day" : "days"} />
        <Stat icon={<BookOpen size={16} />} label="Blocks done" value={`${finished}`} hint={`/ ${routines.length}`} />
      </div>
    </div>
  );
}

function Stat({ icon, label, value, hint }: { icon: ReactNode; label: string; value: string; hint: string }) {
  return (
    <div className="flex items-center gap-3 border border-line bg-surface px-4 py-4">
      <span className="text-muted">{icon}</span>
      <div>
        <p className="text-xs text-muted">{label}</p>
        <p className="font-display text-2xl tabular-nums">
          {value} <span className="text-sm text-muted">{hint}</span>
        </p>
      </div>
    </div>
  );
}

function RoutineRow({ routine, done, active, onToggle, onEdit }: { routine: Routine; done: boolean; active: boolean; onToggle: () => void; onEdit: () => void }) {
  return (
    <div className={`flex items-center gap-3 border-t border-line py-3 ${done ? "opacity-60" : ""}`}>
      <button type="button" aria-label={done ? `Unmark ${routine.subject}` : `Complete ${routine.subject}`} onClick={onToggle} className={`grid size-10 place-items-center border ${done ? "border-ink bg-ink text-bg" : "border-line"}`}>
        {done ? <Check size={15} /> : <BookOpen size={15} />}
      </button>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{routine.subject}</p>
        <p className="text-xs tabular-nums text-muted">
          {timeLabel(routine.start)} – {timeLabel(routine.end)}
        </p>
      </div>
      {active && !done ? <span className="text-xs text-accent">Now</span> : null}
      <button type="button" aria-label={`Edit ${routine.subject}`} className="grid size-10 place-items-center text-muted" onClick={onEdit}>
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
    <section className="border border-line bg-surface p-6">
      <div className="mb-6 flex flex-wrap gap-2">
        {DAYS.map((label, i) => (
          <button key={label} type="button" onClick={() => setDay(i)} className={`h-11 min-w-12 px-3 text-sm ${i === day ? "bg-ink text-bg" : "text-muted"}`}>
            {label}
          </button>
        ))}
      </div>
      <h2 className="mb-2 text-2xl">{DAYS[day]}</h2>
      {list.length ? (
        list.map((r) => <RoutineRow key={r.id} routine={r} done={completions.includes(`${today}:${r.id}`)} active={false} onToggle={() => onToggle(r.id)} onEdit={() => onEdit(r)} />)
      ) : (
        <div className="py-10 text-center">
          <p className="text-muted">Nothing on this day.</p>
          <button type="button" className="mt-4 h-11 bg-ink px-4 text-sm text-bg" onClick={onAdd}>
            Add a block
          </button>
        </div>
      )}
    </section>
  );
}

function FocusCard(props: {
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
  piano: SoundId | null;
  onOpenSound: () => void;
  onStopSound: () => void;
  onStart: () => void;
  onStop: () => void;
}) {
  const { mode, setMode, duration, setDuration, custom, setCustom, subject, setSubject, session, breakEnd, now, piano, onOpenSound, onStopSound, onStart, onStop } = props;
  const running = mode === "break" ? breakEnd : session?.endsAt;
  const total = mode === "break" ? 300 : (session?.duration || duration) * 60;
  const seconds = running ? Math.max(0, Math.ceil((running - now) / 1000)) : total;
  const clock = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
  const pct = total ? Math.max(0, Math.min(100, (1 - seconds / total) * 100)) : 0;
  const active = Boolean(session || (mode === "break" && breakEnd));
  return (
    <section className="border border-line bg-surface p-6 md:p-8">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-2xl">Focus</h2>
        <div className="flex border border-line">
          <button type="button" disabled={Boolean(breakEnd)} className={`h-10 px-3 text-sm ${mode === "focus" ? "bg-ink text-bg" : "text-muted"}`} onClick={() => setMode("focus")}>
            Focus
          </button>
          <button type="button" disabled={Boolean(session)} className={`h-10 px-3 text-sm ${mode === "break" ? "bg-ink text-bg" : "text-muted"}`} onClick={() => setMode("break")}>
            Break
          </button>
        </div>
      </div>
      {!session && mode === "focus" ? (
        <label className="mt-6 block text-sm text-muted">
          What are you working on?
          <input value={subject} maxLength={80} onChange={(e) => setSubject(e.target.value)} className="field text-base text-ink" placeholder="One thing" />
        </label>
      ) : (
        <p className="mt-6 text-sm">{session?.subject || "Five quiet minutes"}</p>
      )}
      <div className="mx-auto my-8 grid size-56 place-items-center rounded-full p-1 timer-ring" style={{ ["--p" as string]: `${active ? pct : 0}%` }}>
        <div className="grid size-full place-items-center rounded-full bg-surface text-center">
          <div>
            <p className="font-display text-6xl tabular-nums">{clock}</p>
            <p className="mt-1 px-8 text-xs text-muted">{session ? "Stay with it." : mode === "break" ? "Look away from the page." : "A little focus goes a long way."}</p>
          </div>
        </div>
      </div>
      {!session && mode === "focus" ? (
        <div className="mb-4 flex flex-wrap justify-center gap-2">
          {[25, 45, 60].map((m) => (
            <button key={m} type="button" className={`h-10 px-3 text-sm ${!custom && duration === m ? "bg-ink text-bg" : "text-muted"}`} onClick={() => { setCustom(false); setDuration(m); }}>
              {m} min
            </button>
          ))}
          <button type="button" className={`h-10 px-3 text-sm ${custom ? "bg-ink text-bg" : "text-muted"}`} onClick={() => setCustom(!custom)}>
            Custom
          </button>
          {custom ? (
            <label className="flex h-10 items-center gap-1 text-sm">
              <input type="number" min={1} max={180} value={duration} aria-label="Custom minutes" className="w-14 border-b border-line bg-transparent text-center outline-none" onChange={(e) => setDuration(Math.max(1, Math.min(180, Number(e.target.value) || 1)))} />
              min
            </label>
          ) : null}
        </div>
      ) : null}
      <div className="flex items-center justify-between gap-3 border-t border-line pt-4">
        <button type="button" onClick={onOpenSound} className="text-left">
          <span className="block text-xs text-muted">Sound</span>
          <span className="mt-1 block text-sm">{piano ? SOUNDS.find((item) => item.id === piano)?.title : "None yet"}</span>
        </button>
        {piano ? (
          <button type="button" onClick={onStopSound} className="h-11 px-3 text-sm text-accent">
            Stop
          </button>
        ) : (
          <button type="button" onClick={onOpenSound} className="h-11 border border-line px-4 text-sm">
            Choose
          </button>
        )}
      </div>
      <button type="button" onClick={active ? onStop : onStart} className="mt-6 h-12 w-full bg-ink text-sm text-bg">
        {active ? "End session" : mode === "break" ? "Start a 5-minute break" : "Start focus"}
      </button>
    </section>
  );
}

function SoundRoom({
  current,
  volume,
  onVolume,
  onPlay,
}: {
  current: SoundId | null;
  volume: number;
  onVolume: (n: number) => void;
  onPlay: (id: SoundId) => void;
}) {
  return (
    <section className="border border-line bg-surface">
      <label className="flex items-center gap-4 border-b border-line px-5 py-4 text-sm text-muted">
        Volume
        <input aria-label="Sound volume" type="range" min={0} max={1} step={0.01} value={volume} className="w-full accent-ink" onChange={(e) => onVolume(Number(e.target.value))} />
      </label>
      {SOUNDS.map((item) => {
        const on = current === item.id;
        return (
          <button key={item.id} type="button" onClick={() => onPlay(item.id)} className="flex w-full items-center justify-between gap-4 border-b border-line px-5 py-5 text-left last:border-b-0">
            <span>
              <span className="block font-display text-3xl">{item.title}</span>
              <span className="mt-1 block text-sm text-muted">{item.copy}</span>
            </span>
            <span className={`shrink-0 text-sm ${on ? "text-accent" : "text-muted"}`}>{on ? "Playing" : "Play"}</span>
          </button>
        );
      })}
      <p className="px-5 py-4 text-xs leading-relaxed text-muted">
        Piano and Quiet are from Mixkit. Rain and Forest are Mixkit sound effects. They play only in this app.
      </p>
    </section>
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
  part,
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
  part: "due" | "notes";
}) {
  const sortedA = [...assignments].sort((a, b) => Number(a.completed) - Number(b.completed) || a.due.localeCompare(b.due));
  const sortedE = [...exams].sort((a, b) => a.date.localeCompare(b.date));
  const sortedN = [...notes].sort((a, b) => b.updatedAt - a.updatedAt);
  return (
    <div className={`grid gap-6 ${part === "due" ? "lg:grid-cols-2" : ""}`}>
      {part === "due" ? (
        <>
      <Panel title="Assignments" action="Add" onAction={onNewAssignment}>
        {sortedA.length === 0 ? <Empty copy="Add one so a deadline does not sneak up." /> : sortedA.map((a) => (
          <div key={a.id} className="flex items-center gap-2 border-t border-line py-3">
            <button type="button" aria-label={`Toggle ${a.title}`} onClick={() => onToggle(a.id)} className={`grid size-10 place-items-center border ${a.completed ? "border-ink bg-ink text-bg" : "border-line"}`}>
              {a.completed ? <Check size={15} /> : <BookOpen size={15} />}
            </button>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{a.title}</p>
              <p className="text-xs text-muted">{a.subject} · {a.priority}</p>
            </div>
            <span className={`text-xs ${daysUntil(a.due) < 0 && !a.completed ? "text-accent" : "text-muted"}`}>{dueLabel(daysUntil(a.due), a.completed)}</span>
            <button type="button" aria-label="Edit assignment" onClick={() => onEditAssignment(a)} className="grid size-10 place-items-center text-muted"><Pencil size={15} /></button>
          </div>
        ))}
      </Panel>
      <Panel title="Exams" action="Add" onAction={onNewExam}>
        {sortedE.length === 0 ? <Empty copy="Add an exam so revision has a date." /> : sortedE.map((e) => {
          const days = daysUntil(e.date);
          return (
            <div key={e.id} className="flex items-center gap-2 border-t border-line py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{e.title}</p>
                <p className="text-xs text-muted">{e.subject}</p>
              </div>
              <span className={`text-xs ${days >= 0 && days <= 7 ? "text-accent" : "text-muted"}`}>{days < 0 ? "Passed" : days === 0 ? "Today" : days === 1 ? "Tomorrow" : `${days} days`}</span>
              <button type="button" aria-label="Edit exam" onClick={() => onEditExam(e)} className="grid size-10 place-items-center text-muted"><Pencil size={15} /></button>
            </div>
          );
        })}
      </Panel>
        </>
      ) : (
      <Panel title="Notes" action="New" onAction={onNewNote}>
        {sortedN.length === 0 ? <Empty copy="A formula, a reading, a reminder." /> : sortedN.map((n) => (
          <button key={n.id} type="button" onClick={() => onEditNote(n)} className="block w-full border-t border-line py-3 text-left">
            <p className="truncate font-medium">{n.title || "Untitled"}</p>
            <p className="truncate text-xs text-muted">{n.subject || "General"}</p>
          </button>
        ))}
      </Panel>
      )}
    </div>
  );
}

function Panel({ title, action, onAction, children }: { title: string; action: string; onAction: () => void; children: ReactNode }) {
  return (
    <section className="border border-line bg-surface p-6">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-2xl">{title}</h2>
        <button type="button" onClick={onAction} className="inline-flex h-11 items-center gap-1 text-sm text-accent">
          <Plus size={15} /> {action}
        </button>
      </div>
      {children}
    </section>
  );
}

function Empty({ copy }: { copy: string }) {
  return <p className="py-6 text-sm text-muted">{copy}</p>;
}

function Progress({ weekly, history, streak, goal }: { weekly: { label: string; minutes: number; key: string }[]; history: { id: string; subject: string; minutes: number; endedAt: number; completed: boolean }[]; streak: number; goal: number }) {
  const weekTotal = weekly.reduce((s, d) => s + d.minutes, 0);
  const max = Math.max(goal, ...weekly.map((d) => d.minutes), 1);
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat icon={<Clock3 size={16} />} label="This week" value={`${Math.round(weekTotal)}`} hint="min" />
        <Stat icon={<Flame size={16} />} label="Streak" value={`${streak}`} hint={streak === 1 ? "day" : "days"} />
        <Stat icon={<BookOpen size={16} />} label="Sessions" value={`${history.length}`} hint="total" />
      </div>
      <section className="border border-line bg-surface p-6">
        <h2 className="mb-6 text-2xl">This week</h2>
        <div className="flex h-44 items-end gap-3">
          {weekly.map((d) => (
            <div key={d.key} className="flex flex-1 flex-col items-center gap-2">
              <div className="flex h-32 w-full items-end bg-line/40">
                <div className="w-full bg-ink" style={{ height: `${(d.minutes / max) * 100}%` }} />
              </div>
              <span className="text-xs text-muted">{d.label}</span>
            </div>
          ))}
        </div>
      </section>
      <section className="border border-line bg-surface p-6">
        <h2 className="mb-2 text-2xl">Recent sessions</h2>
        {history.length === 0 ? <p className="text-sm text-muted">Finished sessions gather here.</p> : history.slice(-8).reverse().map((h) => (
          <div key={h.id} className="flex items-center justify-between border-t border-line py-3 text-sm">
            <div>
              <p className="font-medium">{h.subject}</p>
              <p className="text-xs text-muted">{new Date(h.endedAt).toLocaleDateString()} · {h.completed ? "Completed" : "Ended early"}</p>
            </div>
            <p className="tabular-nums">{Math.round(h.minutes)} min</p>
          </div>
        ))}
      </section>
    </div>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-end bg-scrim/70 p-4 sm:place-items-center" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={title} className="max-h-[90vh] w-full max-w-lg overflow-auto bg-surface p-6" onClick={(e) => e.stopPropagation()}>
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-3xl">{title}</h2>
          <button type="button" className="text-sm text-muted" onClick={onClose}>Close</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="mb-4 block text-sm text-muted">
      {label}
      <div className="mt-1">{children}</div>
    </label>
  );
}

const inputClass = "field";

function RoutineDialog({ routine, onClose, onSave, onDelete }: { routine: Routine; onClose: () => void; onSave: (r: Routine) => void; onDelete: () => void }) {
  const [draft, setDraft] = useState(routine);
  return (
    <Modal title={routine.subject ? "Edit block" : "New study block"} onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); if (!draft.subject.trim() || draft.days.length === 0) return; onSave({ ...draft, subject: draft.subject.trim() }); }}>
        <Field label="Subject"><input required maxLength={80} className={inputClass} value={draft.subject} onChange={(e) => setDraft({ ...draft, subject: e.target.value })} /></Field>
        <Field label="Note"><input maxLength={200} className={inputClass} value={draft.note} onChange={(e) => setDraft({ ...draft, note: e.target.value })} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Start"><input type="time" required className={inputClass} value={draft.start} onChange={(e) => setDraft({ ...draft, start: e.target.value })} /></Field>
          <Field label="End"><input type="time" required className={inputClass} value={draft.end} onChange={(e) => setDraft({ ...draft, end: e.target.value })} /></Field>
        </div>
        <div className="mb-4 flex flex-wrap gap-2">
          {DAYS.map((label, i) => {
            const on = draft.days.includes(i);
            return (
              <button key={label} type="button" className={`h-10 min-w-11 px-2 text-sm ${on ? "bg-ink text-bg" : "text-muted"}`} onClick={() => setDraft({ ...draft, days: on ? draft.days.filter((d) => d !== i) : [...draft.days, i].sort() })}>
                {label}
              </button>
            );
          })}
        </div>
        <DialogActions existing={Boolean(routine.subject)} onDelete={onDelete} />
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
        <Field label="Subject"><input required maxLength={80} className={inputClass} value={draft.subject} onChange={(e) => setDraft({ ...draft, subject: e.target.value })} /></Field>
        <Field label="Due"><input type="date" required className={inputClass} value={draft.due} onChange={(e) => setDraft({ ...draft, due: e.target.value })} /></Field>
        <Field label="Priority">
          <select className={inputClass} value={draft.priority} onChange={(e) => setDraft({ ...draft, priority: e.target.value as Assignment["priority"] })}>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </Field>
        <Field label="Note"><textarea maxLength={300} className={inputClass} rows={3} value={draft.note} onChange={(e) => setDraft({ ...draft, note: e.target.value })} /></Field>
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
        <Field label="Note"><textarea maxLength={300} className={inputClass} rows={3} value={draft.note} onChange={(e) => setDraft({ ...draft, note: e.target.value })} /></Field>
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
        <Field label="Note"><textarea required maxLength={2000} className={inputClass} rows={7} value={draft.content} onChange={(e) => setDraft({ ...draft, content: e.target.value })} /></Field>
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
        <Field label="Name"><input maxLength={40} className={inputClass} value={draftName} onChange={(e) => setDraftName(e.target.value)} placeholder="What should we call you?" /></Field>
        <Field label="Daily intention, in minutes"><input type="number" min={15} max={720} className={inputClass} value={draftGoal} onChange={(e) => setDraftGoal(Number(e.target.value) || 120)} /></Field>
        <p className="mb-4 text-xs text-muted">Plans, focus, deadlines, and notes stay on this device.</p>
        <button type="submit" className="h-11 w-full bg-ink text-sm text-bg">Save</button>
      </form>
    </Modal>
  );
}

function DialogActions({ existing, onDelete }: { existing: boolean; onDelete: () => void }) {
  return (
    <div className="mt-2 flex justify-between">
      {existing ? (
        <button type="button" onClick={onDelete} className="inline-flex h-11 items-center gap-1 text-sm text-accent">
          <Trash2 size={14} /> Delete
        </button>
      ) : <span />}
      <button type="submit" className="h-11 bg-ink px-5 text-sm text-bg">Save</button>
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
