import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  DAYS,
  dayKey,
  daysUntil,
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

type View = "room" | "week" | "shelf" | "record";

const NAV: { id: View; label: string }[] = [
  { id: "room", label: "Room" },
  { id: "week", label: "Week" },
  { id: "shelf", label: "Shelf" },
  { id: "record", label: "Record" },
];

const SITTINGS = [
  { minutes: 25, label: "25", hint: "A short sitting" },
  { minutes: 50, label: "50", hint: "A full block" },
  { minutes: 90, label: "90", hint: "A long stretch" },
];

function Home() {
  const routines = useStudy((s) => s.routines);
  const session = useStudy((s) => s.session);
  const history = useStudy((s) => s.history);
  const completions = useStudy((s) => s.completions);
  const preferences = useStudy((s) => s.preferences);
  const assignments = useStudy((s) => s.assignments);
  const exams = useStudy((s) => s.exams);
  const notes = useStudy((s) => s.notes);
  const intentionByDay = useStudy((s) => s.intentionByDay);
  const upsertRoutine = useStudy((s) => s.upsertRoutine);
  const removeRoutine = useStudy((s) => s.removeRoutine);
  const addStarter = useStudy((s) => s.addStarter);
  const toggleCompletion = useStudy((s) => s.toggleCompletion);
  const startSession = useStudy((s) => s.startSession);
  const endSession = useStudy((s) => s.endSession);
  const setPreferences = useStudy((s) => s.setPreferences);
  const setIntention = useStudy((s) => s.setIntention);
  const upsertAssignment = useStudy((s) => s.upsertAssignment);
  const removeAssignment = useStudy((s) => s.removeAssignment);
  const toggleAssignment = useStudy((s) => s.toggleAssignment);
  const upsertExam = useStudy((s) => s.upsertExam);
  const removeExam = useStudy((s) => s.removeExam);
  const upsertNote = useStudy((s) => s.upsertNote);
  const removeNote = useStudy((s) => s.removeNote);

  const [ready, setReady] = useState(false);
  const [view, setView] = useState<View>("room");
  const [now, setNow] = useState(() => Date.now());
  const [day, setDay] = useState(() => new Date().getDay());
  const [begin, setBegin] = useState(false);
  const [subject, setSubject] = useState("");
  const [minutes, setMinutes] = useState(50);
  const [closing, setClosing] = useState<null | { completed: boolean }>(null);
  const [line, setLine] = useState("");
  const [sound, setSound] = useState<SoundKind | null>(null);
  const [volume, setVolume] = useState(0.2);
  const [editor, setEditor] = useState<Routine | null>(null);
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [exam, setExam] = useState<Exam | null>(null);
  const [page, setPage] = useState<Note | null>(null);
  const [nameOpen, setNameOpen] = useState(false);
  const audio = useRef<Soundscape | null>(null);

  useEffect(() => {
    void useStudy.persist.rehydrate();
    setReady(true);
    const tick = window.setInterval(() => setNow(Date.now()), 1000);
    return () => {
      window.clearInterval(tick);
      audio.current?.dispose();
    };
  }, []);

  const date = new Date(now);
  const today = dayKey(date);
  const todayBlocks = routines
    .filter((r) => r.enabled && r.days.includes(date.getDay()))
    .sort((a, b) => a.start.localeCompare(b.start));
  const current = todayBlocks.find((r) => routineActive(r, date));
  const upcoming = todayBlocks.find((r) => r.start > `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`);
  const horizon = useMemo(() => {
    const items = [
      ...assignments.filter((a) => !a.completed).map((a) => ({ id: a.id, title: a.title, subject: a.subject, date: a.due, kind: "Work" as const })),
      ...exams.map((e) => ({ id: e.id, title: e.title, subject: e.subject, date: e.date, kind: "Exam" as const })),
    ].filter((item) => daysUntil(item.date) >= 0);
    items.sort((a, b) => a.date.localeCompare(b.date));
    return items.slice(0, 3);
  }, [assignments, exams]);

  const studiedDays = useMemo(() => {
    const set = new Set(history.filter((h) => h.minutes >= 1).map((h) => dayKey(new Date(h.endedAt))));
    return set;
  }, [history]);

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

  function openBegin(prefill?: string) {
    setSubject(prefill || current?.subject || upcoming?.subject || "");
    setMinutes(50);
    setBegin(true);
  }

  function closeSitting(completed: boolean) {
    endSession(completed, line);
    setClosing(null);
    setLine("");
    setBegin(false);
  }

  return (
    <div className="min-h-screen bg-bg text-ink">
      <header className="mx-auto flex max-w-5xl items-end justify-between px-5 pt-6 md:px-8 md:pt-8">
        <button type="button" onClick={() => setView("room")} className="text-left">
          <span className="font-display text-2xl tracking-tight">Perseva</span>
        </button>
        <button type="button" onClick={() => setNameOpen(true)} className="text-sm text-muted">
          {preferences.name || "Your name"}
        </button>
      </header>

      <nav className="mx-auto mt-8 hidden max-w-5xl gap-8 border-b border-line px-8 md:flex">
        {NAV.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setView(item.id)}
            className={`-mb-px border-b pb-3 text-sm ${view === item.id ? "border-ink font-medium text-ink" : "border-transparent text-muted"}`}
          >
            {item.label}
          </button>
        ))}
      </nav>

      <main className="mx-auto max-w-5xl px-5 py-10 pb-28 md:px-8 md:pb-16">
        {!ready ? <p className="text-muted">Opening the room…</p> : null}

        {view === "room" ? (
          <Room
            date={date}
            name={preferences.name}
            intention={intentionByDay[today] ?? ""}
            onIntention={(text) => setIntention(today, text)}
            current={current}
            upcoming={upcoming}
            horizon={horizon}
            hasBlocks={routines.length > 0}
            onBegin={() => openBegin(current?.subject || upcoming?.subject)}
            onArrange={() => {
              setDay(date.getDay());
              setView("week");
            }}
            onStarter={addStarter}
            onShelf={() => setView("shelf")}
          />
        ) : null}

        {view === "week" ? (
          <Week
            day={day}
            setDay={setDay}
            routines={routines}
            today={today}
            weekday={date.getDay()}
            completions={completions}
            onToggle={(id) => toggleCompletion(`${today}:${id}`)}
            onEdit={setEditor}
            onAdd={() => setEditor(blankRoutine(day))}
          />
        ) : null}

        {view === "shelf" ? (
          <Shelf
            assignments={assignments}
            exams={exams}
            notes={notes}
            onToggle={toggleAssignment}
            onEditAssignment={setAssignment}
            onEditExam={setExam}
            onEditNote={setPage}
            onNewWork={() => setAssignment(blankAssignment())}
            onNewExam={() => setExam(blankExam())}
            onNewPage={() => setPage(blankNote())}
          />
        ) : null}

        {view === "record" ? <Record history={history} studiedDays={studiedDays} today={date} /> : null}
      </main>

      <nav className="fixed inset-x-0 bottom-0 flex justify-around border-t border-line bg-surface py-3 md:hidden">
        {NAV.map((item) => (
          <button key={item.id} type="button" onClick={() => setView(item.id)} className={`min-h-11 px-3 text-sm ${view === item.id ? "text-ink" : "text-muted"}`}>
            {item.label}
          </button>
        ))}
      </nav>

      {session ? (
        <Sitting
          subject={session.subject}
          endsAt={session.endsAt}
          duration={session.duration}
          now={now}
          sound={sound}
          volume={volume}
          closing={closing !== null || session.endsAt <= now}
          completed={closing?.completed ?? session.endsAt <= now}
          line={line}
          setLine={setLine}
          onVolume={(value) => {
            setVolume(value);
            audio.current?.volume(value);
          }}
          onPlay={(kind) => void play(kind)}
          onLeave={() => setClosing({ completed: false })}
          onKeep={() => setClosing(null)}
          onSave={() => closeSitting(closing?.completed ?? true)}
        />
      ) : null}

      {begin && !session ? (
        <Sheet title="Begin a sitting" onClose={() => setBegin(false)}>
          <label className="block text-sm text-muted">
            What will you stay with?
            <input className="field mt-1 text-lg text-ink" value={subject} maxLength={80} onChange={(e) => setSubject(e.target.value)} placeholder="One subject" />
          </label>
          <div className="mt-6 grid grid-cols-3 gap-3">
            {SITTINGS.map((item) => (
              <button
                key={item.minutes}
                type="button"
                onClick={() => setMinutes(item.minutes)}
                className={`border px-2 py-4 text-left ${minutes === item.minutes ? "border-ink bg-surface" : "border-line"}`}
              >
                <span className="block font-display text-3xl tabular-nums">{item.label}</span>
                <span className="mt-1 block text-xs text-muted">{item.hint}</span>
              </button>
            ))}
          </div>
          <button
            type="button"
            className="mt-8 h-12 w-full bg-ink text-sm text-bg"
            onClick={() => {
              startSession(subject.trim() || "Untitled sitting", minutes);
              setBegin(false);
            }}
          >
            Close the door
          </button>
        </Sheet>
      ) : null}

      {editor ? (
        <BlockSheet
          routine={editor}
          onClose={() => setEditor(null)}
          onSave={(next) => {
            if (next.end <= next.start || next.days.length === 0 || !next.subject.trim()) return;
            upsertRoutine({ ...next, subject: next.subject.trim() });
            setEditor(null);
          }}
          onDelete={() => {
            removeRoutine(editor.id);
            setEditor(null);
          }}
        />
      ) : null}

      {assignment ? (
        <DueSheet
          title={assignment.title ? "Edit work" : "Work due"}
          nameLabel="Title"
          name={assignment.title}
          subject={assignment.subject}
          date={assignment.due}
          note={assignment.note}
          existing={Boolean(assignment.title)}
          onClose={() => setAssignment(null)}
          onDelete={() => {
            removeAssignment(assignment.id);
            setAssignment(null);
          }}
          onSave={(next) => {
            upsertAssignment({ ...assignment, ...next, title: next.name });
            setAssignment(null);
          }}
        />
      ) : null}

      {exam ? (
        <DueSheet
          title={exam.title ? "Edit exam" : "Exam"}
          nameLabel="Exam"
          name={exam.title}
          subject={exam.subject}
          date={exam.date}
          note={exam.note}
          existing={Boolean(exam.title)}
          onClose={() => setExam(null)}
          onDelete={() => {
            removeExam(exam.id);
            setExam(null);
          }}
          onSave={(next) => {
            upsertExam({ ...exam, title: next.name, subject: next.subject, date: next.date, note: next.note });
            setExam(null);
          }}
        />
      ) : null}

      {page ? (
        <Sheet title={page.title ? page.title : "A page"} onClose={() => setPage(null)} wide>
          <PageForm
            note={page}
            onDelete={() => {
              removeNote(page.id);
              setPage(null);
            }}
            onSave={(next) => {
              upsertNote({ ...next, updatedAt: Date.now() });
              setPage(null);
            }}
          />
        </Sheet>
      ) : null}

      {nameOpen ? (
        <Sheet title="The room is yours" onClose={() => setNameOpen(false)}>
          <NameForm
            name={preferences.name}
            onSave={(name) => {
              setPreferences({ ...preferences, name: name.slice(0, 40) });
              setNameOpen(false);
            }}
          />
        </Sheet>
      ) : null}
    </div>
  );
}

function Room({
  date,
  name,
  intention,
  onIntention,
  current,
  upcoming,
  horizon,
  hasBlocks,
  onBegin,
  onArrange,
  onStarter,
  onShelf,
}: {
  date: Date;
  name: string;
  intention: string;
  onIntention: (text: string) => void;
  current?: Routine;
  upcoming?: Routine;
  horizon: { id: string; title: string; subject: string; date: string; kind: "Work" | "Exam" }[];
  hasBlocks: boolean;
  onBegin: () => void;
  onArrange: () => void;
  onStarter: () => void;
  onShelf: () => void;
}) {
  const focus = current || upcoming;
  return (
    <div className="grid items-start gap-12 lg:grid-cols-[1.15fr_0.85fr] lg:gap-20">
      <section>
        <p className="text-sm text-muted">{date.toLocaleDateString("en-GB", { weekday: "long" })}</p>
        <h1 className="mt-2 font-display text-5xl leading-none md:text-7xl">
          {date.toLocaleDateString("en-GB", { day: "numeric", month: "long" })}
        </h1>
        <p className="mt-6 max-w-md text-lg text-muted">
          {name ? `${name}, one thing is enough.` : "One thing is enough."}
        </p>
        <label className="mt-10 block max-w-lg">
          <span className="text-xs text-muted">Today</span>
          <input
            className="field font-display text-2xl"
            value={intention}
            maxLength={140}
            placeholder="I will stay with…"
            onChange={(e) => onIntention(e.target.value)}
          />
        </label>
      </section>

      <aside>
        {focus ? (
          <div>
            <p className="text-xs text-muted">{current ? "Now" : "Next"}</p>
            <p className="mt-2 font-display text-3xl">{focus.subject}</p>
            <p className="mt-1 text-sm tabular-nums text-muted">
              {timeLabel(focus.start)} – {timeLabel(focus.end)}
            </p>
            {focus.note ? <p className="mt-3 text-sm text-muted">{focus.note}</p> : null}
            <button type="button" onClick={onBegin} className="mt-6 h-12 bg-ink px-6 text-sm text-bg">
              Sit down
            </button>
          </div>
        ) : (
          <div>
            <p className="font-display text-3xl">The day is open.</p>
            <p className="mt-3 max-w-xs text-sm text-muted">Arrange an hour, or begin without one.</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <button type="button" onClick={onBegin} className="h-12 bg-ink px-5 text-sm text-bg">
                Begin anyway
              </button>
              <button type="button" onClick={onArrange} className="h-12 border border-line px-5 text-sm">
                Arrange the week
              </button>
            </div>
            {!hasBlocks ? (
              <button type="button" onClick={onStarter} className="mt-4 text-sm text-accent">
                Sketch a quiet weekday
              </button>
            ) : null}
          </div>
        )}

        <div className="mt-10 border-t border-line pt-6">
          <div className="flex items-baseline justify-between">
            <p className="text-xs text-muted">On the horizon</p>
            <button type="button" onClick={onShelf} className="text-xs text-accent">
              Shelf
            </button>
          </div>
          {horizon.length === 0 ? (
            <p className="mt-3 text-sm text-muted">Nothing due. The shelf is clear.</p>
          ) : (
            <ul className="mt-3 space-y-3">
              {horizon.map((item) => (
                <li key={item.id} className="flex items-baseline justify-between gap-4">
                  <span>
                    <span className="block">{item.title}</span>
                    <span className="text-xs text-muted">{item.kind} · {item.subject}</span>
                  </span>
                  <span className="shrink-0 text-sm tabular-nums text-muted">{when(daysUntil(item.date))}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>
    </div>
  );
}

function Week({
  day,
  setDay,
  routines,
  today,
  weekday,
  completions,
  onToggle,
  onEdit,
  onAdd,
}: {
  day: number;
  setDay: (d: number) => void;
  routines: Routine[];
  today: string;
  weekday: number;
  completions: string[];
  onToggle: (id: string) => void;
  onEdit: (r: Routine) => void;
  onAdd: () => void;
}) {
  const list = routines.filter((r) => r.days.includes(day)).sort((a, b) => a.start.localeCompare(b.start));
  return (
    <section>
      <div className="flex items-end justify-between gap-4">
        <h1 className="text-4xl md:text-5xl">The week</h1>
        <button type="button" onClick={onAdd} className="h-11 text-sm text-accent">
          Add an hour
        </button>
      </div>
      <div className="mt-8 flex gap-2 overflow-x-auto">
        {DAYS.map((label, i) => (
          <button
            key={label}
            type="button"
            onClick={() => setDay(i)}
            className={`h-16 min-w-14 border px-3 text-left ${i === day ? "border-ink bg-surface" : "border-line text-muted"}`}
          >
            <span className="block text-xs">{label}</span>
            {i === weekday ? <span className="mt-2 block size-1.5 rounded-full bg-accent" /> : null}
          </button>
        ))}
      </div>
      <div className="mt-8">
        {list.length === 0 ? (
          <p className="border-t border-line py-10 text-muted">Nothing on {DAYS[day]}. Leave it empty, or give it one hour.</p>
        ) : (
          list.map((block) => {
            const done = completions.includes(`${today}:${block.id}`) && day === weekday;
            return (
              <div key={block.id} className="grid grid-cols-[7rem_1fr_auto] items-baseline gap-4 border-t border-line py-5">
                <p className="text-sm tabular-nums text-muted">{timeLabel(block.start)}</p>
                <button type="button" onClick={() => onEdit(block)} className="text-left">
                  <span className={`block text-lg ${done ? "text-muted line-through" : ""}`}>{block.subject}</span>
                  <span className="text-sm text-muted">
                    until {timeLabel(block.end)}
                    {block.note ? ` · ${block.note}` : ""}
                  </span>
                </button>
                {day === weekday ? (
                  <button type="button" onClick={() => onToggle(block.id)} className="text-sm text-accent">
                    {done ? "Undo" : "Done"}
                  </button>
                ) : (
                  <span />
                )}
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}

function Shelf({
  assignments,
  exams,
  notes,
  onToggle,
  onEditAssignment,
  onEditExam,
  onEditNote,
  onNewWork,
  onNewExam,
  onNewPage,
}: {
  assignments: Assignment[];
  exams: Exam[];
  notes: Note[];
  onToggle: (id: string) => void;
  onEditAssignment: (a: Assignment) => void;
  onEditExam: (e: Exam) => void;
  onEditNote: (n: Note) => void;
  onNewWork: () => void;
  onNewExam: () => void;
  onNewPage: () => void;
}) {
  const work = [...assignments].sort((a, b) => Number(a.completed) - Number(b.completed) || a.due.localeCompare(b.due));
  const tests = [...exams].sort((a, b) => a.date.localeCompare(b.date));
  const pages = [...notes].sort((a, b) => b.updatedAt - a.updatedAt);
  return (
    <div className="grid gap-16 lg:grid-cols-2">
      <section>
        <div className="flex items-end justify-between">
          <h1 className="text-4xl">Due</h1>
          <div className="flex gap-4 text-sm">
            <button type="button" className="text-accent" onClick={onNewWork}>Work</button>
            <button type="button" className="text-accent" onClick={onNewExam}>Exam</button>
          </div>
        </div>
        {work.length + tests.length === 0 ? (
          <p className="mt-8 text-muted">Nothing is waiting. Add work or an exam when it has a date.</p>
        ) : (
          <div className="mt-6">
            {work.map((item) => (
              <div key={item.id} className="grid grid-cols-[1fr_auto] gap-3 border-t border-line py-4">
                <button type="button" className="text-left" onClick={() => onEditAssignment(item)}>
                  <span className={item.completed ? "text-muted line-through" : ""}>{item.title}</span>
                  <span className="mt-1 block text-xs text-muted">Work · {item.subject}</span>
                </button>
                <button type="button" onClick={() => onToggle(item.id)} className="text-right text-sm tabular-nums text-muted">
                  {item.completed ? "Done" : when(daysUntil(item.due))}
                </button>
              </div>
            ))}
            {tests.map((item) => (
              <button key={item.id} type="button" onClick={() => onEditExam(item)} className="grid w-full grid-cols-[1fr_auto] gap-3 border-t border-line py-4 text-left">
                <span>
                  {item.title}
                  <span className="mt-1 block text-xs text-muted">Exam · {item.subject}</span>
                </span>
                <span className="text-sm tabular-nums text-muted">{when(daysUntil(item.date))}</span>
              </button>
            ))}
          </div>
        )}
      </section>
      <section>
        <div className="flex items-end justify-between">
          <h1 className="text-4xl">Pages</h1>
          <button type="button" className="text-sm text-accent" onClick={onNewPage}>New page</button>
        </div>
        {pages.length === 0 ? (
          <p className="mt-8 text-muted">A page for a proof, a reading, a thing you do not want to lose.</p>
        ) : (
          <div className="mt-6">
            {pages.map((note) => (
              <button key={note.id} type="button" onClick={() => onEditNote(note)} className="block w-full border-t border-line py-4 text-left">
                <span className="font-display text-2xl">{note.title || "Untitled"}</span>
                <span className="mt-1 block line-clamp-2 text-sm text-muted">{note.content}</span>
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Record({
  history,
  studiedDays,
  today,
}: {
  history: { id: string; subject: string; minutes: number; endedAt: number; completed: boolean; reflection?: string }[];
  studiedDays: Set<string>;
  today: Date;
}) {
  const week = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    const offset = (d.getDay() + 6) % 7;
    d.setDate(d.getDate() - offset + i);
    return { key: dayKey(d), label: DAYS[d.getDay()] };
  });
  const count = week.filter((d) => studiedDays.has(d.key)).length;
  const recent = [...history].reverse().slice(0, 12);
  return (
    <section>
      <h1 className="max-w-xl text-4xl md:text-5xl">
        {count === 0 ? "No sittings yet this week." : count === 1 ? "One day this week." : `${count} days this week.`}
      </h1>
      <div className="mt-8 flex gap-3">
        {week.map((d) => (
          <div key={d.key} className="text-center">
            <div className={`size-8 border ${studiedDays.has(d.key) ? "border-accent bg-accent" : "border-line bg-surface"}`} />
            <p className="mt-2 text-xs text-muted">{d.label.slice(0, 1)}</p>
          </div>
        ))}
      </div>
      <div className="mt-12">
        {recent.length === 0 ? (
          <p className="text-muted">When you close a sitting, it stays here with whatever you wrote.</p>
        ) : (
          recent.map((item) => (
            <article key={item.id} className="border-t border-line py-6">
              <p className="text-xs text-muted">
                {new Date(item.endedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                {" · "}
                {Math.round(item.minutes)} min
                {item.completed ? "" : " · left early"}
              </p>
              <h2 className="mt-1 text-2xl">{item.subject}</h2>
              {item.reflection ? <p className="mt-2 max-w-xl text-muted">{item.reflection}</p> : null}
            </article>
          ))
        )}
      </div>
    </section>
  );
}

function Sitting({
  subject,
  endsAt,
  duration,
  now,
  sound,
  volume,
  closing,
  completed,
  line,
  setLine,
  onVolume,
  onPlay,
  onLeave,
  onKeep,
  onSave,
}: {
  subject: string;
  endsAt: number;
  duration: number;
  now: number;
  sound: SoundKind | null;
  volume: number;
  closing: boolean;
  completed: boolean;
  line: string;
  setLine: (s: string) => void;
  onVolume: (n: number) => void;
  onPlay: (k: SoundKind) => void;
  onLeave: () => void;
  onKeep: () => void;
  onSave: () => void;
}) {
  const total = duration * 60;
  const seconds = Math.max(0, Math.ceil((endsAt - now) / 1000));
  const clock = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
  const gone = total ? Math.min(100, ((total - seconds) / total) * 100) : 0;
  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-ink text-bg">
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-6 py-8">
        <p className="text-sm text-line">The door is closed</p>
        <p className="mt-3 font-display text-3xl">{subject}</p>
        <div className="flex flex-1 flex-col items-center justify-center">
          <p className="font-display text-7xl tabular-nums md:text-8xl">{clock}</p>
          <div className="mt-8 h-px w-full max-w-sm bg-line/40">
            <div className="h-px bg-bg" style={{ width: `${gone}%` }} />
          </div>
        </div>
        {closing ? (
          <div>
            <p className="font-display text-3xl">{completed ? "The hour is kept." : "Leave it here?"}</p>
            <label className="mt-4 block text-sm text-line">
              One line, if you want it remembered
              <input
                className="mt-2 w-full border-0 border-b border-line/50 bg-transparent py-2 text-lg text-bg outline-none"
                value={line}
                maxLength={280}
                placeholder="What moved"
                onChange={(e) => setLine(e.target.value)}
              />
            </label>
            <div className="mt-6 flex gap-3">
              {!completed ? (
                <button type="button" onClick={onKeep} className="h-12 border border-line/40 px-5 text-sm">
                  Stay
                </button>
              ) : null}
              <button type="button" onClick={onSave} className="h-12 bg-bg px-5 text-sm text-ink">
                Close the sitting
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex gap-4 text-sm">
              {(["rain", "stream", "piano"] as const).map((kind) => (
                <button key={kind} type="button" onClick={() => onPlay(kind)} className={sound === kind ? "text-bg" : "text-line"}>
                  {kind === "piano" ? "Keys" : kind === "stream" ? "Water" : "Rain"}
                </button>
              ))}
              <input aria-label="Atmosphere" type="range" min={0} max={1} step={0.01} value={volume} className="w-20 accent-bg" onChange={(e) => onVolume(Number(e.target.value))} />
            </div>
            <button type="button" onClick={onLeave} className="h-11 text-sm text-line">
              Leave
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Sheet({ title, onClose, children, wide = false }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end bg-ink/40 sm:items-center sm:justify-center" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className={`max-h-[92vh] w-full overflow-auto bg-surface p-6 ${wide ? "sm:max-w-2xl" : "sm:max-w-md"}`}
      >
        <div className="mb-6 flex items-start justify-between gap-4">
          <h2 className="text-3xl">{title}</h2>
          <button type="button" onClick={onClose} className="text-sm text-muted">
            Close
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function BlockSheet({
  routine,
  onClose,
  onSave,
  onDelete,
}: {
  routine: Routine;
  onClose: () => void;
  onSave: (r: Routine) => void;
  onDelete: () => void;
}) {
  const [draft, setDraft] = useState(routine);
  return (
    <Sheet title={routine.subject ? "This hour" : "An hour"} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSave(draft);
        }}
      >
        <label className="block text-sm text-muted">
          Subject
          <input required className="field" value={draft.subject} maxLength={80} onChange={(e) => setDraft({ ...draft, subject: e.target.value })} />
        </label>
        <label className="mt-4 block text-sm text-muted">
          A note to yourself
          <input className="field" value={draft.note} maxLength={160} onChange={(e) => setDraft({ ...draft, note: e.target.value })} />
        </label>
        <div className="mt-4 grid grid-cols-2 gap-4">
          <label className="text-sm text-muted">
            From
            <input type="time" required className="field" value={draft.start} onChange={(e) => setDraft({ ...draft, start: e.target.value })} />
          </label>
          <label className="text-sm text-muted">
            Until
            <input type="time" required className="field" value={draft.end} onChange={(e) => setDraft({ ...draft, end: e.target.value })} />
          </label>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {DAYS.map((label, i) => {
            const on = draft.days.includes(i);
            return (
              <button
                key={label}
                type="button"
                className={`h-10 min-w-11 border px-2 text-sm ${on ? "border-ink" : "border-line text-muted"}`}
                onClick={() => setDraft({ ...draft, days: on ? draft.days.filter((d) => d !== i) : [...draft.days, i].sort() })}
              >
                {label}
              </button>
            );
          })}
        </div>
        <div className="mt-8 flex items-center justify-between">
          {routine.subject ? (
            <button type="button" onClick={onDelete} className="text-sm text-accent">
              Remove
            </button>
          ) : (
            <span />
          )}
          <button type="submit" className="h-11 bg-ink px-5 text-sm text-bg">
            Keep this hour
          </button>
        </div>
      </form>
    </Sheet>
  );
}

function DueSheet({
  title,
  nameLabel,
  name,
  subject,
  date,
  note,
  existing,
  onClose,
  onDelete,
  onSave,
}: {
  title: string;
  nameLabel: string;
  name: string;
  subject: string;
  date: string;
  note: string;
  existing: boolean;
  onClose: () => void;
  onDelete: () => void;
  onSave: (next: { name: string; subject: string; date: string; note: string }) => void;
}) {
  const [draft, setDraft] = useState({ name, subject, date, note });
  return (
    <Sheet title={title} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!draft.name.trim() || !draft.subject.trim()) return;
          onSave({ ...draft, name: draft.name.trim(), subject: draft.subject.trim() });
        }}
      >
        <label className="block text-sm text-muted">
          {nameLabel}
          <input required className="field" value={draft.name} maxLength={120} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
        </label>
        <label className="mt-4 block text-sm text-muted">
          Subject
          <input required className="field" value={draft.subject} maxLength={80} onChange={(e) => setDraft({ ...draft, subject: e.target.value })} />
        </label>
        <label className="mt-4 block text-sm text-muted">
          Date
          <input type="date" required className="field" value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} />
        </label>
        <label className="mt-4 block text-sm text-muted">
          Note
          <textarea className="field" rows={3} maxLength={300} value={draft.note} onChange={(e) => setDraft({ ...draft, note: e.target.value })} />
        </label>
        <div className="mt-8 flex items-center justify-between">
          {existing ? (
            <button type="button" onClick={onDelete} className="text-sm text-accent">
              Remove
            </button>
          ) : (
            <span />
          )}
          <button type="submit" className="h-11 bg-ink px-5 text-sm text-bg">
            Save
          </button>
        </div>
      </form>
    </Sheet>
  );
}

function PageForm({ note, onSave, onDelete }: { note: Note; onSave: (n: Note) => void; onDelete: () => void }) {
  const [draft, setDraft] = useState(note);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!draft.title.trim()) return;
        onSave({ ...draft, title: draft.title.trim() });
      }}
    >
      <input required className="field font-display text-3xl" value={draft.title} maxLength={100} placeholder="Title" onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
      <input className="field mt-2 text-sm" value={draft.subject} maxLength={80} placeholder="Subject, if it has one" onChange={(e) => setDraft({ ...draft, subject: e.target.value })} />
      <textarea required className="field mt-4 min-h-48" maxLength={4000} value={draft.content} placeholder="Write it down." onChange={(e) => setDraft({ ...draft, content: e.target.value })} />
      <div className="mt-6 flex items-center justify-between">
        {note.title ? (
          <button type="button" onClick={onDelete} className="text-sm text-accent">
            Remove
          </button>
        ) : (
          <span />
        )}
        <button type="submit" className="h-11 bg-ink px-5 text-sm text-bg">
          Keep the page
        </button>
      </div>
    </form>
  );
}

function NameForm({ name, onSave }: { name: string; onSave: (name: string) => void }) {
  const [draft, setDraft] = useState(name);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave(draft.trim());
      }}
    >
      <label className="block text-sm text-muted">
        What should the room call you?
        <input className="field text-lg" value={draft} maxLength={40} onChange={(e) => setDraft(e.target.value)} />
      </label>
      <p className="mt-4 text-sm text-muted">Sittings, hours, and pages stay on this device.</p>
      <button type="submit" className="mt-6 h-11 bg-ink px-5 text-sm text-bg">
        Save
      </button>
    </form>
  );
}

function when(days: number) {
  if (days < 0) return "Passed";
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  return `${days} days`;
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
