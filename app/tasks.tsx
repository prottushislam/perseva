'use client';
import {useState} from 'react';
import {Plus,Check,Trash2,Calendar,AlertCircle,BookOpen,Pencil,Clock} from 'lucide-react';
import {type Assignment,type Exam,type Note,daysUntil} from '@/lib/study';
import {Modal,IconButton} from './ui';

export function TasksView({
  assignments, exams, notes, saving, onSaveAssignments, onSaveExams, onSaveNotes
}: {
  assignments: Assignment[];
  exams: Exam[];
  notes: Note[];
  saving: boolean;
  onSaveAssignments: (next: Assignment[]) => Promise<boolean>;
  onSaveExams: (next: Exam[]) => Promise<boolean>;
  onSaveNotes: (next: Note[]) => Promise<boolean>;
}) {
  const [editingAssign, setEditingAssign] = useState<Assignment | null>(null);
  const [editingExam, setEditingExam] = useState<Exam | null>(null);
  const [editingNote, setEditingNote] = useState<Note | null>(null);

  const upcomingAssign = [...assignments].sort((a,b) => a.due.localeCompare(b.due));
  const upcomingExams = [...exams].sort((a,b) => a.date.localeCompare(b.date));

  return (
    <div className="tasks-layout">
      <section className="card">
        <div className="card-heading">
          <div>
            <span className="eyebrow">DEADLINES</span>
            <h2>Assignments</h2>
          </div>
          <button className="soft-button" onClick={() => setEditingAssign({
            id: crypto.randomUUID(), title: '', subject: '', due: new Date().toISOString().slice(0,10),
            priority: 'medium', completed: false, color: 'peach', note: ''
          })}><Plus size={16}/> Add assignment</button>
        </div>
        {upcomingAssign.length === 0 ? (
          <div className="empty-routine">
            <div className="empty-icon"><Calendar size={28} strokeWidth={1.4}/></div>
            <h3>No deadlines yet.</h3>
            <p>Add an assignment so nothing sneaks up on you.</p>
          </div>
        ) : (
          <div className="routine-list">
            {upcomingAssign.map(a => {
              const days = daysUntil(a.due);
              const overdue = days < 0 && !a.completed;
              return (
                <div key={a.id} className={`routine-row ${a.color} ${a.completed ? 'done' : ''}`}>
                  <button className={`routine-check ${a.completed ? 'checked' : ''}`} disabled={saving}
                    onClick={() => void onSaveAssignments(assignments.map(x => x.id === a.id ? {...x, completed: !x.completed} : x))}>
                    {a.completed ? <Check size={15}/> : <BookOpen size={16}/>}
                  </button>
                  <div className="routine-copy">
                    <strong>{a.title}</strong>
                    <span>{a.subject} · {a.priority} priority</span>
                  </div>
                  <span className={`small-tag ${overdue ? 'overdue' : days <= 2 ? 'soon' : ''}`}>
                    {a.completed ? 'Done' : overdue ? `${-days}d overdue` : days === 0 ? 'Due today' : days === 1 ? 'Due tomorrow' : `${days}d left`}
                  </span>
                  <IconButton label="Edit" onClick={() => setEditingAssign(a)}><Pencil size={15}/></IconButton>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="card">
        <div className="card-heading">
          <div>
            <span className="eyebrow">UPCOMING</span>
            <h2>Exams</h2>
          </div>
          <button className="soft-button" onClick={() => setEditingExam({
            id: crypto.randomUUID(), title: '', subject: '', date: new Date().toISOString().slice(0,10),
            color: 'purple', note: ''
          })}><Plus size={16}/> Add exam</button>
        </div>
        {upcomingExams.length === 0 ? (
          <div className="empty-routine">
            <div className="empty-icon"><AlertCircle size={28} strokeWidth={1.4}/></div>
            <h3>No exams scheduled.</h3>
            <p>Add one so you can plan revision with calm.</p>
          </div>
        ) : (
          <div className="routine-list">
            {upcomingExams.map(e => {
              const days = daysUntil(e.date);
              return (
                <div key={e.id} className={`routine-row ${e.color}`}>
                  <div className="routine-copy">
                    <strong>{e.title}</strong>
                    <span>{e.subject}</span>
                  </div>
                  <span className={`small-tag ${days < 0 ? 'overdue' : days <= 7 ? 'soon' : ''}`}>
                    {days < 0 ? 'Passed' : days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : `${days} days`}
                  </span>
                  <IconButton label="Edit" onClick={() => setEditingExam(e)}><Pencil size={15}/></IconButton>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="card">
        <div className="card-heading">
          <div>
            <span className="eyebrow">CAPTURE</span>
            <h2>Notes</h2>
          </div>
          <button className="soft-button" onClick={() => setEditingNote({
            id: crypto.randomUUID(), title: '', content: '', subject: '', updatedAt: Date.now()
          })}><Plus size={16}/> New note</button>
        </div>
        {notes.length === 0 ? (
          <div className="empty-routine">
            <div className="empty-icon"><BookOpen size={28} strokeWidth={1.4}/></div>
            <h3>A quiet place for ideas.</h3>
            <p>Jot down a thought, formula, or reminder.</p>
          </div>
        ) : (
          <div className="routine-list">
            {notes.slice().sort((a,b) => b.updatedAt - a.updatedAt).map(n => (
              <div key={n.id} className="routine-row blue">
                <div className="routine-copy">
                  <strong>{n.title || 'Untitled'}</strong>
                  <span>{n.subject || 'General'} · {new Date(n.updatedAt).toLocaleDateString()}</span>
                </div>
                <IconButton label="Edit" onClick={() => setEditingNote(n)}><Pencil size={15}/></IconButton>
              </div>
            ))}
          </div>
        )}
      </section>

      {editingAssign && (
        <Modal title={editingAssign.title ? 'Edit assignment' : 'New assignment'} onClose={() => setEditingAssign(null)}>
          <form onSubmit={e => { e.preventDefault(); void onSaveAssignments([...assignments.filter(x => x.id !== editingAssign.id), editingAssign]).then(ok => ok && setEditingAssign(null)); }}>
            <label>Title<input required value={editingAssign.title} onChange={e => setEditingAssign({...editingAssign, title: e.target.value})} maxLength={120}/></label>
            <label>Subject / Course<input required value={editingAssign.subject} onChange={e => setEditingAssign({...editingAssign, subject: e.target.value})} maxLength={80}/></label>
            <label>Due date<input type="date" required value={editingAssign.due} onChange={e => setEditingAssign({...editingAssign, due: e.target.value})}/></label>
            <label>Priority
              <select value={editingAssign.priority} onChange={e => setEditingAssign({...editingAssign, priority: e.target.value as any})}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </label>
            <label>Note (optional)<textarea value={editingAssign.note || ''} onChange={e => setEditingAssign({...editingAssign, note: e.target.value})} maxLength={300}/></label>
            <div className="modal-actions">
              {editingAssign.title && <button type="button" className="soft-button" onClick={() => void onSaveAssignments(assignments.filter(x => x.id !== editingAssign.id)).then(() => setEditingAssign(null))}>Delete</button>}
              <button type="submit" className="primary" disabled={saving}>Save</button>
            </div>
          </form>
        </Modal>
      )}

      {editingExam && (
        <Modal title={editingExam.title ? 'Edit exam' : 'New exam'} onClose={() => setEditingExam(null)}>
          <form onSubmit={e => { e.preventDefault(); void onSaveExams([...exams.filter(x => x.id !== editingExam.id), editingExam]).then(ok => ok && setEditingExam(null)); }}>
            <label>Title<input required value={editingExam.title} onChange={e => setEditingExam({...editingExam, title: e.target.value})} maxLength={120}/></label>
            <label>Subject<input required value={editingExam.subject} onChange={e => setEditingExam({...editingExam, subject: e.target.value})} maxLength={80}/></label>
            <label>Date<input type="date" required value={editingExam.date} onChange={e => setEditingExam({...editingExam, date: e.target.value})}/></label>
            <label>Note (optional)<textarea value={editingExam.note || ''} onChange={e => setEditingExam({...editingExam, note: e.target.value})} maxLength={300}/></label>
            <div className="modal-actions">
              {editingExam.title && <button type="button" className="soft-button" onClick={() => void onSaveExams(exams.filter(x => x.id !== editingExam.id)).then(() => setEditingExam(null))}>Delete</button>}
              <button type="submit" className="primary" disabled={saving}>Save</button>
            </div>
          </form>
        </Modal>
      )}

      {editingNote && (
        <Modal title={editingNote.title ? 'Edit note' : 'New note'} onClose={() => setEditingNote(null)} wide>
          <form onSubmit={e => { e.preventDefault(); const next = {...editingNote, updatedAt: Date.now()}; void onSaveNotes([...notes.filter(x => x.id !== next.id), next]).then(ok => ok && setEditingNote(null)); }}>
            <label>Title<input required value={editingNote.title} onChange={e => setEditingNote({...editingNote, title: e.target.value})} maxLength={100}/></label>
            <label>Subject (optional)<input value={editingNote.subject || ''} onChange={e => setEditingNote({...editingNote, subject: e.target.value})} maxLength={80}/></label>
            <label>Content<textarea required value={editingNote.content} onChange={e => setEditingNote({...editingNote, content: e.target.value})} rows={8} maxLength={2000}/></label>
            <div className="modal-actions">
              {editingNote.title && <button type="button" className="soft-button" onClick={() => void onSaveNotes(notes.filter(x => x.id !== editingNote.id)).then(() => setEditingNote(null))}>Delete</button>}
              <button type="submit" className="primary" disabled={saving}>Save</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
