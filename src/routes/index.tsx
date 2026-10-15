import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  AlarmClock,
  BookOpen,
  CalendarDays,
  Check,
  Clock3,
  Flame,
  LayoutDashboard,
  Pencil,
  Plus,
  Settings2,
  Timer,
  Trash2,
} from "lucide-react";
import {
  DAYS,
  buildCalendar,
  dayKey,
  daysUntil,
  downloadText,
  dueLabel,
  routineActive,
  timeLabel,
  useStudy,
  type Alarm,
  type Assignment,
  type Exam,
  type FocusTemplate,
  type Note,
  type Routine,
} from "@/lib/study";
import { Ambience, SOUNDS, type SoundId } from "@/lib/soundscape";

export const Route = createFileRoute("/")({ component: Home });

type View = "today" | "focus" | "schedule" | "deadlines" | "progress" | "settings";

const NAV: { id: View; label: string; short: string; icon: typeof LayoutDashboard }[] = [
  { id: "today", label: "Today", short: "Today", icon: LayoutDashboard },
  { id: "focus", label: "Focus", short: "Focus", icon: Timer },
  { id: "schedule", label: "Schedule", short: "Week", icon: CalendarDays },
  { id: "deadlines", label: "Deadlines", short: "Due", icon: BookOpen },
  { id: "progress", label: "Progress", short: "Stats", icon: Flame },
  { id: "settings", label: "Settings", short: "Set", icon: Settings2 },
];

function Home() {
  const store = useStudy();
  const [ready, setReady] = useState(false);
  const [view, setView] = useState<View>("today");
  const [now, setNow] = useState(() => Date.now());
  const [menu, setMenu] = useState(false);
  const [toast, setToast] = useState("");
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
  const [sound, setSound] = useState<SoundId | null>(null);
  const [volume, setVolume] = useState(0.8);
  const [ringing, setRinging] = useState<Alarm | null>(null);
  const [alarm, setAlarm] = useState<Alarm | null>(null);
  const audio = useRef<Ambience | null>(null);
  const ending = useRef(false);
  const breakMinutes = store.preferences.breakMinutes || 5;

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

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.text = store.preferences.largeText ? "large" : "";
    root.dataset.motion = store.preferences.reducedMotion ? "reduce" : "";
  }, [store.preferences.largeText, store.preferences.reducedMotion]);

  useEffect(() => {
    if (!ready || ringing) return;
    const clock = new Date(now);
    const hhmm = `${String(clock.getHours()).padStart(2, "0")}:${String(clock.getMinutes()).padStart(2, "0")}`;
    const stamp = `${dayKey(clock)} ${hhmm}`;
    const hit = store.alarms.find((item) => {
      if (!item.enabled) return false;
      if (item.snoozedUntil && now >= item.snoozedUntil) return true;
      if (item.time !== hhmm || item.lastFired === stamp) return false;
      return item.days.length === 0 || item.days.includes(clock.getDay());
    });
    if (!hit) return;
    store.markAlarm(hit.id, { lastFired: stamp, snoozedUntil: 0 });
    setRinging(hit);
    if (!audio.current) audio.current = new Ambience();
    void audio.current.play(hit.sound, volume).then(() => setSound(hit.sound)).catch(() => undefined);
    if (store.preferences.notify && "Notification" in window && Notification.permission === "granted") {
      new Notification(hit.label || "Perseva", { body: "Time to show up.", silent: false });
    }
  }, [now, ready, ringing, store]);

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
      copy: "Your classes, what is due, and one quiet place to focus.",
    },
    focus: { title: "Stay with one thing.", copy: "Choose a length, a task, and a sound. Nothing else has to happen." },
    schedule: { title: "The week, by subject.", copy: "Classes and study blocks. Change a day whenever the week changes." },
    deadlines: { title: "What is coming.", copy: "Assignments, exams, and the notes you do not want to lose." },
    progress: { title: "The time you have given.", copy: "A week, the subjects you returned to, and the sessions you finished." },
    settings: { title: "Your space, on this device.", copy: "Perseva stays free. Your plans stay here unless you export them." },
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
      onOpenSound={() => go("focus")}
      onStopSound={() => {
        audio.current?.stop();
        setSound(null);
      }}
      onStart={() => {
        if (mode === "break") {
          setBreakEnd(Date.now() + breakMinutes * 60_000);
          return;
        }
        store.startSession(subject, duration);
        if (!sound) void playSound("piano");
        setToast(sound ? "One thing, for a little while." : "Piano is on. You can change it below.");
      }}
      onStop={() => {
        if (store.session) setConfirmEnd(true);
        else setBreakEnd(null);
      }}
      breakMinutes={breakMinutes}
    />
  );

  return (
    <div className="min-h-screen bg-bg text-ink">
      <aside className={`${menu ? "fixed inset-y-0 left-0 z-30 flex" : "hidden"} w-64 flex-col border border-line bg-surface p-4 md:fixed md:top-4 md:bottom-4 md:left-4 md:flex`}>
        <button type="button" className="mb-8 flex items-center gap-3 rounded-2xl px-2 py-1 text-left" onClick={() => go("today")}>
          <img src="/logo.png" alt="" className="size-12 rounded-2xl" />
          <span className="font-display text-3xl leading-none">Perseva</span>
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
                className={`flex h-11 items-center gap-3 rounded-xl px-3 text-left text-sm ${active ? "bg-accent/15 font-medium text-ink" : "text-muted"}`}
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

      <div className="md:pl-72">
        <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-line bg-bg/90 px-4 backdrop-blur md:px-8">
          <div className="flex items-center gap-3 text-sm text-muted">
            <button type="button" className="md:hidden" aria-label="Open menu" onClick={() => setMenu(true)}>
              <img src="/logo.png" alt="" className="size-9 rounded-xl" />
            </button>
            <span className="text-ink">{NAV.find((n) => n.id === view)?.label}</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="hidden text-sm text-muted sm:inline">
              {date.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}
            </span>
            <button type="button" aria-label="Settings" className="grid size-11 place-items-center text-muted" onClick={() => go("settings")}>
              {store.preferences.name ? <span className="font-display text-lg text-ink">{store.preferences.name[0].toUpperCase()}</span> : <Settings2 size={18} />}
            </button>
          </div>
        </header>

        <main className="mx-auto max-w-6xl px-4 py-8 pb-28 md:px-8 md:pb-12">
          <div className="mb-8 flex flex-wrap items-end justify-between gap-6">
            <div className="max-w-xl">
              <p className="text-sm text-muted">{date.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}</p>
              <h1 className="mt-3 max-w-xl text-[2.15rem] leading-[1.12] md:text-5xl">{headings[view].title}</h1>
              <p className="mt-3 text-muted">{headings[view].copy}</p>
            </div>
            {view === "schedule" ? (
              <button type="button" className="h-11 bg-accent px-4 text-sm text-[#06211a]" onClick={() => setEditor(blankRoutine(selectedDay))}>
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
              focus={focusCard}
              sound={sound}
              onPlaySound={(id) => void playSound(id)}
              onToggle={(id) => store.toggleCompletion(`${today}:${id}`)}
              onEdit={setEditor}
              onAdd={() => setEditor(blankRoutine(date.getDay()))}
              onStarter={() => {
                store.addStarter();
                setToast("A weekday plan is in place. Change it as you like.");
              }}
              onOpenSchedule={(day) => {
                setSelectedDay(day);
                go("schedule");
              }}
              onOpenTasks={() => go("deadlines")}
            />
          ) : null}

          {view === "focus" ? (
            <div className="mx-auto max-w-xl space-y-6">
              {focusCard}
              <Templates
                templates={store.templates}
                onUse={(item) => {
                  setSubject(item.subject);
                  setDuration(item.minutes);
                  setCustom(![25, 45, 60].includes(item.minutes));
                  store.setPreferences({ breakMinutes: item.breakMinutes });
                  if (item.sound) void playSound(item.sound);
                  setToast(`${item.name} is ready.`);
                }}
                onSave={() => {
                  const item: FocusTemplate = {
                    id: crypto.randomUUID(),
                    name: subject.trim() || `${duration} min`,
                    subject: subject.trim() || "Deep work",
                    minutes: duration,
                    breakMinutes,
                    sound: sound ?? "",
                  };
                  store.upsertTemplate(item);
                  setToast("Saved as a template. It stays on this device.");
                }}
                onRemove={store.removeTemplate}
              />
              <SoundRoom current={sound} volume={volume} onVolume={changeVolume} onPlay={(id) => void playSound(id)} />
            </div>
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

          {view === "deadlines" ? (
            <div className="space-y-6">
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
            </div>
          ) : null}

          {view === "progress" ? <Progress weekly={weekly} history={store.history} streak={streak} goal={store.preferences.dailyGoal} /> : null}

          {view === "settings" ? (
            <SettingsPage
              preferences={store.preferences}
              alarms={store.alarms}
              onSave={store.setPreferences}
              onAlarm={setAlarm}
              onExport={() => {
                downloadText(
                  "perseva-backup.json",
                  JSON.stringify(
                    {
                      routines: store.routines,
                      history: store.history,
                      completions: store.completions,
                      preferences: store.preferences,
                      assignments: store.assignments,
                      exams: store.exams,
                      notes: store.notes,
                      templates: store.templates,
                      alarms: store.alarms,
                    },
                    null,
                    2,
                  ),
                  "application/json",
                );
                setToast("Backup downloaded. Keep the file somewhere safe.");
              }}
              onImport={async (file) => {
                try {
                  const data = JSON.parse(await file.text()) as Partial<ReturnType<typeof useStudy.getState>>;
                  if (!data || typeof data !== "object") throw new Error("empty");
                  store.replaceData({
                    routines: Array.isArray(data.routines) ? data.routines : undefined,
                    history: Array.isArray(data.history) ? data.history : undefined,
                    assignments: Array.isArray(data.assignments) ? data.assignments : undefined,
                    exams: Array.isArray(data.exams) ? data.exams : undefined,
                    notes: Array.isArray(data.notes) ? data.notes : undefined,
                    templates: Array.isArray(data.templates) ? data.templates : undefined,
                    alarms: Array.isArray(data.alarms) ? data.alarms : undefined,
                    preferences: data.preferences && typeof data.preferences === "object" ? data.preferences : undefined,
                  });
                  setToast("Backup restored on this device.");
                } catch {
                  setToast("That file could not be read.");
                }
              }}
              onCalendar={() => {
                downloadText("perseva.ics", buildCalendar(store.routines, store.assignments, store.exams), "text/calendar");
                setToast("Calendar file ready. Open it in Google Calendar.");
              }}
              onNotify={async () => {
                if (!("Notification" in window)) {
                  setToast("This browser cannot show notifications.");
                  return;
                }
                const result = await Notification.requestPermission();
                store.setPreferences({ notify: result === "granted" });
                setToast(result === "granted" ? "Reminders can appear while Perseva is open." : "Notifications stay off.");
              }}
            />
          ) : null}
        </main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-6 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] md:hidden">
        {NAV.map((item) => {
          const Icon = item.icon;
          const active = view === item.id;
          return (
            <button key={item.id} type="button" aria-label={item.label} onClick={() => go(item.id)} className={`flex min-h-16 flex-col items-center justify-center gap-1 ${active ? "text-ink" : "text-muted"}`}>
              <Icon size={18} strokeWidth={1.5} />
              <span className="text-[10px] leading-none tracking-tight">{item.short}</span>
            </button>
          );
        })}
      </nav>

      {toast ? <div className={`fixed left-1/2 z-40 -translate-x-1/2 bg-ink px-4 py-3 text-sm text-bg ${sound ? "bottom-32 md:bottom-20" : "bottom-20 md:bottom-6"}`}>{toast}</div> : null}

      {sound ? (
        <div className="fixed inset-x-0 bottom-16 z-30 flex items-center justify-between gap-3 border-t border-line bg-surface px-4 py-3 md:bottom-4 md:left-72 md:right-4 md:rounded-2xl md:border">
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
      {alarm ? (
        <AlarmDialog
          item={alarm}
          onClose={() => setAlarm(null)}
          onSave={(next) => {
            store.upsertAlarm(next);
            setAlarm(null);
            setToast("Alarm saved. It rings while Perseva is open.");
          }}
          onDelete={() => {
            store.removeAlarm(alarm.id);
            setAlarm(null);
          }}
        />
      ) : null}
      {ringing ? (
        <AlarmRing
          alarm={ringing}
          onSnooze={() => {
            const until = Date.now() + Math.max(1, ringing.snooze) * 60_000;
            store.markAlarm(ringing.id, { snoozedUntil: until, lastFired: "" });
            setRinging(null);
            setToast(`Snoozed for ${ringing.snooze} min.`);
          }}
          onDone={() => setRinging(null)}
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
              className="h-11 bg-accent px-4 text-sm text-[#06211a]"
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
  sound,
  onPlaySound,
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
  sound: SoundId | null;
  onPlaySound: (id: SoundId) => void;
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
    <div className="space-y-6">
      <div className="grid items-start gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="space-y-6">
          {focus}
          <section className="border border-line bg-surface p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-2xl">The room</h2>
              <span className="text-sm text-muted">{sound ? "Playing" : "Off"}</span>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {SOUNDS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onPlaySound(item.id)}
                  className={`h-12 rounded-xl text-sm ${sound === item.id ? "bg-accent text-[#06211a]" : "border border-line text-muted"}`}
                >
                  {item.title}
                </button>
              ))}
            </div>
          </section>
        </div>
        <div className="space-y-6">
      <section className="border border-line bg-surface p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-2xl">Today’s schedule</h2>
            <button type="button" className="inline-flex h-11 items-center gap-1 text-sm text-accent" onClick={onAdd}>
              <Plus size={15} /> Add
            </button>
          </div>
          <div className="mb-4 grid grid-cols-7 gap-1">
            {[1, 2, 3, 4, 5, 6, 0].map((d) => (
              <button key={d} type="button" onClick={() => onOpenSchedule(d)} className={`h-11 rounded-xl text-xs ${d === date.getDay() ? "bg-accent text-[#06211a]" : "text-muted"}`}>
                {DAYS[d]}
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
              <p className="mx-auto mt-2 max-w-xs text-sm text-muted">{hasAny ? "Today is open. Rest is allowed." : "A subject, a time, a small promise."}</p>
              <button type="button" className="mt-4 h-11 bg-accent px-4 text-sm text-[#06211a]" onClick={onAdd}>
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
        </div>
      </div>
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
        <Stat icon={<Clock3 size={16} />} label="Focused today" value={`${Math.round(totalToday)}`} hint="min" />
        <Stat icon={<Flame size={16} />} label="Streak" value={`${streak}`} hint={streak === 1 ? "day" : "days"} />
        <Stat icon={<BookOpen size={16} />} label="Blocks done" value={`${finished}`} hint={`/ ${routines.length}`} />
      </div>
      <p className="text-sm text-muted">About {goal} quiet minutes is enough. A missed day can begin again tomorrow.</p>
    </div>
  );
}

function Stat({ icon, label, value, hint }: { icon: ReactNode; label: string; value: string; hint: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-4">
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
      <button type="button" aria-label={done ? `Unmark ${routine.subject}` : `Complete ${routine.subject}`} onClick={onToggle} className={`grid size-10 place-items-center border ${done ? "border-ink bg-accent text-[#06211a]" : "border-line"}`}>
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
          <button key={label} type="button" onClick={() => setDay(i)} className={`h-11 min-w-12 px-3 text-sm ${i === day ? "bg-accent text-[#06211a]" : "text-muted"}`}>
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
          <button type="button" className="mt-4 h-11 bg-accent px-4 text-sm text-[#06211a]" onClick={onAdd}>
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
  breakMinutes: number;
}) {
  const { mode, setMode, duration, setDuration, custom, setCustom, subject, setSubject, session, breakEnd, now, piano, onOpenSound, onStopSound, onStart, onStop, breakMinutes } = props;
  const running = mode === "break" ? breakEnd : session?.endsAt;
  const total = mode === "break" ? breakMinutes * 60 : (session?.duration || duration) * 60;
  const seconds = running ? Math.max(0, Math.ceil((running - now) / 1000)) : total;
  const clock = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
  const pct = total ? Math.max(0, Math.min(100, (1 - seconds / total) * 100)) : 0;
  const active = Boolean(session || (mode === "break" && breakEnd));
  return (
    <section className="border border-line bg-surface p-6 md:p-8">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-2xl">Focus</h2>
        <div className="flex border border-line">
          <button type="button" disabled={Boolean(breakEnd)} className={`h-10 px-3 text-sm ${mode === "focus" ? "bg-accent text-[#06211a]" : "text-muted"}`} onClick={() => setMode("focus")}>
            Focus
          </button>
          <button type="button" disabled={Boolean(session)} className={`h-10 px-3 text-sm ${mode === "break" ? "bg-accent text-[#06211a]" : "text-muted"}`} onClick={() => setMode("break")}>
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
            <button key={m} type="button" className={`h-10 px-3 text-sm ${!custom && duration === m ? "bg-accent text-[#06211a]" : "text-muted"}`} onClick={() => { setCustom(false); setDuration(m); }}>
              {m} min
            </button>
          ))}
          <button type="button" className={`h-10 px-3 text-sm ${custom ? "bg-accent text-[#06211a]" : "text-muted"}`} onClick={() => setCustom(!custom)}>
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
      <button type="button" onClick={active ? onStop : onStart} className="mt-6 h-12 w-full bg-accent text-sm text-[#06211a]">
        {active ? "End session" : mode === "break" ? `Start a ${breakMinutes}-minute break` : "Start focus"}
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
        {sortedA.length === 0 ? <Empty copy="Nothing due yet. Add one before it sneaks up." /> : sortedA.map((a) => (
          <div key={a.id} className="flex items-center gap-2 border-t border-line py-3">
            <button type="button" aria-label={`Toggle ${a.title}`} onClick={() => onToggle(a.id)} className={`grid size-10 place-items-center border ${a.completed ? "border-ink bg-accent text-[#06211a]" : "border-line"}`}>
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
        {sortedE.length === 0 ? <Empty copy="An exam date gives revision a place to land." /> : sortedE.map((e) => {
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
        {sortedN.length === 0 ? <Empty copy="A formula, a reading, a reminder to yourself." /> : sortedN.map((n) => (
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
        <h2 className="mb-4 text-2xl">By subject</h2>
        {history.length === 0 ? <p className="text-sm text-muted">Subjects appear after a session.</p> : Object.entries(
          history.reduce<Record<string, number>>((map, item) => {
            map[item.subject] = (map[item.subject] ?? 0) + item.minutes;
            return map;
          }, {}),
        )
          .sort((a, b) => b[1] - a[1])
          .slice(0, 6)
          .map(([name, minutes]) => (
            <div key={name} className="flex items-center justify-between border-t border-line py-3 text-sm">
              <p className="font-medium">{name}</p>
              <p className="tabular-nums text-muted">{Math.round(minutes)} min</p>
            </div>
          ))}
      </section>
      <section className="border border-line bg-surface p-6">
        <h2 className="mb-2 text-2xl">Recent sessions</h2>
        {history.length === 0 ? <p className="text-sm text-muted">One finished session is a start.</p> : history.slice(-8).reverse().map((h) => (
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
              <button key={label} type="button" className={`h-10 min-w-11 px-2 text-sm ${on ? "bg-accent text-[#06211a]" : "text-muted"}`} onClick={() => setDraft({ ...draft, days: on ? draft.days.filter((d) => d !== i) : [...draft.days, i].sort() })}>
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

function Templates({
  templates,
  onUse,
  onSave,
  onRemove,
}: {
  templates: FocusTemplate[];
  onUse: (item: FocusTemplate) => void;
  onSave: () => void;
  onRemove: (id: string) => void;
}) {
  return (
    <section className="border border-line bg-surface p-6">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-2xl">Templates</h2>
        <button type="button" onClick={onSave} className="text-sm text-accent">Save this</button>
      </div>
      {templates.length === 0 ? <p className="text-sm text-muted">Save a length and a subject you use often.</p> : templates.map((item) => (
        <div key={item.id} className="flex items-center gap-3 border-t border-line py-3">
          <button type="button" onClick={() => onUse(item)} className="min-w-0 flex-1 text-left">
            <p className="truncate font-medium">{item.name}</p>
            <p className="text-xs text-muted">{item.minutes} min · {item.breakMinutes} min break</p>
          </button>
          <button type="button" aria-label={`Remove ${item.name}`} onClick={() => onRemove(item.id)} className="grid size-10 place-items-center text-muted"><Trash2 size={15} /></button>
        </div>
      ))}
    </section>
  );
}

function SettingsPage({
  preferences,
  alarms,
  onSave,
  onAlarm,
  onExport,
  onImport,
  onCalendar,
  onNotify,
}: {
  preferences: { name: string; dailyGoal: number; breakMinutes: number; largeText: boolean; reducedMotion: boolean; notify: boolean };
  alarms: Alarm[];
  onSave: (next: Partial<{ name: string; dailyGoal: number; breakMinutes: number; largeText: boolean; reducedMotion: boolean; notify: boolean }>) => void;
  onAlarm: (alarm: Alarm) => void;
  onExport: () => void;
  onImport: (file: File) => void;
  onCalendar: () => void;
  onNotify: () => void;
}) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="border border-line bg-surface p-6">
        <h2 className="text-2xl">Preferences</h2>
        <label className="mt-4 block text-sm text-muted">
          Name
          <input maxLength={40} className={inputClass} value={preferences.name} placeholder="What should we call you?" onChange={(e) => onSave({ name: e.target.value.slice(0, 40) })} />
        </label>
        <label className="mt-4 block text-sm text-muted">
          Daily aim, in minutes
          <input type="number" min={15} max={720} className={inputClass} value={preferences.dailyGoal} onChange={(e) => onSave({ dailyGoal: Math.max(15, Math.min(720, Number(e.target.value) || 15)) })} />
        </label>
        <label className="mt-4 block text-sm text-muted">
          Break length
          <input type="number" min={1} max={30} className={inputClass} value={preferences.breakMinutes} onChange={(e) => onSave({ breakMinutes: Math.max(1, Math.min(30, Number(e.target.value) || 5)) })} />
        </label>
        <label className="mt-5 flex items-center justify-between gap-4 text-sm">
          Larger text
          <input type="checkbox" checked={preferences.largeText} onChange={(e) => onSave({ largeText: e.target.checked })} />
        </label>
        <label className="mt-3 flex items-center justify-between gap-4 text-sm">
          Reduce motion
          <input type="checkbox" checked={preferences.reducedMotion} onChange={(e) => onSave({ reducedMotion: e.target.checked })} />
        </label>
        <button type="button" onClick={onNotify} className="mt-5 h-11 text-sm text-accent">
          {preferences.notify ? "Reminders are allowed" : "Allow reminders"}
        </button>
        <p className="mt-2 text-xs text-muted">Alarms and reminders only ring while this tab or the installed app is open. Perseva cannot wake the phone if the browser is fully closed.</p>
      </section>
      <section className="border border-line bg-surface p-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-2xl">Alarms</h2>
          <button type="button" className="inline-flex h-11 items-center gap-1 text-sm text-accent" onClick={() => onAlarm(blankAlarm())}>
            <Plus size={15} /> Add
          </button>
        </div>
        {alarms.length === 0 ? <p className="text-sm text-muted">A label, a time, and the days it should repeat.</p> : alarms.map((item) => (
          <button key={item.id} type="button" onClick={() => onAlarm(item)} className="flex w-full items-center justify-between gap-3 border-t border-line py-3 text-left">
            <span>
              <span className="flex items-center gap-2 font-medium"><AlarmClock size={15} /> {item.label || "Alarm"}</span>
              <span className="mt-1 block text-xs text-muted">{timeLabel(item.time)} · {item.days.length ? item.days.map((day) => DAYS[day]).join(" ") : "Once"}{item.mission === "math" ? " · math to dismiss" : ""}</span>
            </span>
            <span className="text-xs text-muted">{item.enabled ? "On" : "Off"}</span>
          </button>
        ))}
      </section>
      <section className="border border-line bg-surface p-6 lg:col-span-2">
        <h2 className="text-2xl">Your data</h2>
        <p className="mt-2 max-w-2xl text-sm text-muted">Everything stays on this device. Export a backup, bring it back later, or download a calendar file for Google Calendar. Nothing is locked, and nothing is sold.</p>
        <div className="mt-5 flex flex-wrap gap-3">
          <button type="button" onClick={onExport} className="h-11 bg-accent px-4 text-sm text-[#06211a]">Download backup</button>
          <label className="inline-flex h-11 cursor-pointer items-center border border-line px-4 text-sm">
            Restore backup
            <input type="file" accept="application/json,.json" className="sr-only" onChange={(e) => { const file = e.target.files?.[0]; if (file) onImport(file); e.target.value = ""; }} />
          </label>
          <button type="button" onClick={onCalendar} className="h-11 border border-line px-4 text-sm">Export calendar</button>
        </div>
        <p className="mt-8 max-w-xl text-sm leading-relaxed text-muted">
          Perseva stays free for every student. If it helps, star the project or share it with a classmate. There is no paid plan and no feature behind a lock.
        </p>
        <a className="mt-3 inline-flex text-sm text-accent" href="https://github.com/prottushislam/perseva" target="_blank" rel="noreferrer">Support Perseva on GitHub</a>
      </section>
    </div>
  );
}

function AlarmDialog({ item, onClose, onSave, onDelete }: { item: Alarm; onClose: () => void; onSave: (alarm: Alarm) => void; onDelete: () => void }) {
  const [draft, setDraft] = useState(item);
  return (
    <Modal title={item.label ? "Edit alarm" : "New alarm"} onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); onSave({ ...draft, label: draft.label.trim() || "Alarm" }); }}>
        <Field label="Label"><input required maxLength={60} className={inputClass} value={draft.label} onChange={(e) => setDraft({ ...draft, label: e.target.value })} placeholder="Morning revision" /></Field>
        <Field label="Time"><input type="time" required className={inputClass} value={draft.time} onChange={(e) => setDraft({ ...draft, time: e.target.value })} /></Field>
        <div className="mb-4 flex flex-wrap gap-2">
          {DAYS.map((label, i) => {
            const on = draft.days.includes(i);
            return (
              <button key={label} type="button" className={`h-10 min-w-11 px-2 text-sm ${on ? "bg-accent text-[#06211a]" : "text-muted"}`} onClick={() => setDraft({ ...draft, days: on ? draft.days.filter((d) => d !== i) : [...draft.days, i].sort() })}>
                {label}
              </button>
            );
          })}
        </div>
        <Field label="Snooze, in minutes"><input type="number" min={1} max={30} className={inputClass} value={draft.snooze} onChange={(e) => setDraft({ ...draft, snooze: Math.max(1, Math.min(30, Number(e.target.value) || 5)) })} /></Field>
        <Field label="Sound">
          <select className={inputClass} value={draft.sound} onChange={(e) => setDraft({ ...draft, sound: e.target.value as Alarm["sound"] })}>
            {SOUNDS.map((sound) => <option key={sound.id} value={sound.id}>{sound.title}</option>)}
          </select>
        </Field>
        <Field label="To turn it off">
          <select className={inputClass} value={draft.mission} onChange={(e) => setDraft({ ...draft, mission: e.target.value as Alarm["mission"] })}>
            <option value="none">Just dismiss</option>
            <option value="math">Solve a short sum</option>
          </select>
        </Field>
        <label className="mb-4 flex items-center justify-between text-sm text-muted">
          Enabled
          <input type="checkbox" checked={draft.enabled} onChange={(e) => setDraft({ ...draft, enabled: e.target.checked })} />
        </label>
        <DialogActions existing={Boolean(item.label)} onDelete={onDelete} />
      </form>
    </Modal>
  );
}

function AlarmRing({ alarm, onSnooze, onDone }: { alarm: Alarm; onSnooze: () => void; onDone: () => void }) {
  const [puzzle] = useState(() => {
    const a = 2 + Math.floor(Math.random() * 11);
    const b = 2 + Math.floor(Math.random() * 11);
    return { a, b, answer: String(a + b) };
  });
  const [value, setValue] = useState("");
  const [wrong, setWrong] = useState(false);
  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-scrim/80 p-4">
      <div role="alertdialog" aria-label={alarm.label} className="w-full max-w-md bg-surface p-6">
        <p className="text-sm text-muted">{timeLabel(alarm.time)}</p>
        <h2 className="mt-2 text-4xl">{alarm.label || "Time to show up"}</h2>
        {alarm.mission === "math" ? (
          <label className="mt-6 block text-sm text-muted">
            {puzzle.a} + {puzzle.b}
            <input inputMode="numeric" className={inputClass} value={value} onChange={(e) => { setValue(e.target.value); setWrong(false); }} />
          </label>
        ) : <p className="mt-4 text-sm text-muted">A small start is enough.</p>}
        {wrong ? <p className="mt-2 text-sm text-accent">Not quite. Try once more.</p> : null}
        <div className="mt-6 flex justify-end gap-3">
          <button type="button" className="h-11 px-3 text-sm" onClick={onSnooze}>Snooze</button>
          <button
            type="button"
            className="h-11 bg-accent px-4 text-sm text-[#06211a]"
            onClick={() => {
              if (alarm.mission === "math" && value.trim() !== puzzle.answer) {
                setWrong(true);
                return;
              }
              onDone();
            }}
          >
            I’m up
          </button>
        </div>
      </div>
    </div>
  );
}

function blankAlarm(): Alarm {
  return {
    id: crypto.randomUUID(),
    label: "",
    time: "07:00",
    days: [1, 2, 3, 4, 5],
    enabled: true,
    sound: "piano",
    snooze: 5,
    mission: "none",
    lastFired: "",
    snoozedUntil: 0,
  };
}

function DialogActions({ existing, onDelete }: { existing: boolean; onDelete: () => void }) {
  return (
    <div className="mt-2 flex justify-between">
      {existing ? (
        <button type="button" onClick={onDelete} className="inline-flex h-11 items-center gap-1 text-sm text-accent">
          <Trash2 size={14} /> Delete
        </button>
      ) : <span />}
      <button type="submit" className="h-11 bg-accent px-5 text-sm text-[#06211a]">Save</button>
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
