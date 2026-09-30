import { useState } from 'react';
import { elapsedSeconds, type Task, type ActivitySegment } from '../domain/models';
import type { ActiveTimer, LifeService } from '../services/lifeService';
export function formatElapsed(seconds: number) {
  const total = Math.floor(Math.max(0, seconds)); const hours = Math.floor(total / 3600);
  return hours ? `${hours}:${String(Math.floor(total / 60) % 60).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}` : `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}
export function TaskList({ tasks, activities, active, now, life, act, calendarAction, disabled = false }: {
  tasks: Task[]; activities: ActivitySegment[]; active: ActiveTimer; now: number; disabled?: boolean;
  life: LifeService; act: (action: () => Promise<unknown>) => void; calendarAction: (task: Task) => void;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  return <ul className="task-list">{tasks.map(task => {
    const running = active && ('legacy' in active ? active.taskId === task.id : activities.some(a => a.id === active.segmentId && a.taskId === task.id));
    const legacyLive = active && 'legacy' in active && active.taskId === task.id ? Math.max(0, (now - active.startedAt) / 1000) : 0;
    return <li key={task.id} className={task.completed ? 'task-row completed' : 'task-row'}>
      <input type="checkbox" disabled={disabled} aria-label={`Complete ${task.title}`} checked={task.completed} onChange={() => act(() => life.setCompleted(task.id))} />
      <div className="task-main">{editing === task.id ? <form onSubmit={e => { e.preventDefault(); act(async () => { await life.editTask(task.id, { title }); setEditing(null); }); }}>
        <input aria-label="Edit task title" value={title} onChange={e => setTitle(e.target.value)} maxLength={140} autoFocus /><button type="submit">Save</button><button type="button" onClick={() => setEditing(null)}>Cancel</button>
      </form> : <button disabled={disabled} className="task-title" title="Edit task" onClick={() => { setEditing(task.id); setTitle(task.title); }}>{task.title}</button>}
      <span className="time-label">{formatElapsed(elapsedSeconds(task, activities, now) + legacyLive)}{task.legacyElapsedSeconds > 0 && <span className="legacy-note"> · includes earlier time</span>}</span></div>
      <div className="task-actions">
        <button disabled={disabled} aria-label={`${task.priority ? 'Remove priority' : 'Make priority'}: ${task.title}`} aria-pressed={task.priority} onClick={() => act(() => life.editTask(task.id, { priority: !task.priority }))}>{task.priority ? '★' : '☆'}</button>
        <button aria-label={`${running ? 'Pause' : 'Start'} timer: ${task.title}`} disabled={disabled || task.completed} onClick={() => act(() => life.toggleTimer(task.id))}>{running ? 'Pause' : 'Start'}</button>
        <button disabled={disabled} aria-label={`Add to Calendar: ${task.title}`} onClick={() => calendarAction(task)}>Calendar</button>
        <button disabled={disabled} aria-label={`Remove ${task.title}`} onClick={() => act(() => life.setCompleted(task.id, true))}>Remove</button>
      </div>
    </li>;
  })}</ul>;
}
