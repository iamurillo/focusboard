import { useState } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react';

export default function CalendarView({ tasks, columns }) {
  const [currentDate, setCurrentDate] = useState(new Date());

  const allTasks = Object.values(tasks).filter(t => t.dueDate);

  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDayIndex = new Date(year, month, 1).getDay();
    
    const days = [];
    // padding for previous month
    for (let i = 0; i < firstDayIndex; i++) {
      days.push(null);
    }
    // current month days
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(new Date(year, month, i));
    }
    return days;
  };

  const prevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };
  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const days = getDaysInMonth(currentDate);

  return (
    <div className="list-view-container">
      <div className="calendar-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', background: 'var(--bg-board)', padding: '1rem', borderRadius: 'var(--radius-lg)' }}>
        <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <CalendarIcon color="var(--accent-primary)"/> 
          {currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
        </h2>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn btn-ghost" onClick={prevMonth}><ChevronLeft size={20}/></button>
          <button className="btn btn-ghost" onClick={nextMonth}><ChevronRight size={20}/></button>
        </div>
      </div>

      <div className="calendar-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.5rem' }}>
        {['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map(d => (
          <div key={d} style={{ textAlign: 'center', fontWeight: 'bold', padding: '0.5rem', color: 'var(--text-muted)' }}>{d}</div>
        ))}
        
        {days.map((day, idx) => {
          if (!day) return <div key={`empty-${idx}`} className="calendar-day empty" style={{ background: 'transparent' }}></div>;
          
          const dayString = day.toISOString().split('T')[0];
          const dayTasks = allTasks.filter(t => t.dueDate === dayString);
          const isToday = dayString === new Date().toISOString().split('T')[0];

          return (
            <div key={idx} className="calendar-day" style={{ 
              background: 'var(--bg-board)', 
              minHeight: '100px', 
              padding: '0.5rem', 
              borderRadius: 'var(--radius-md)', 
              border: isToday ? '2px solid var(--accent-primary)' : '1px solid var(--border-color)',
              overflowY: 'auto'
            }}>
              <div style={{ fontWeight: isToday ? 'bold' : 'normal', color: isToday ? 'var(--accent-primary)' : 'inherit', marginBottom: '0.5rem' }}>
                {day.getDate()}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                {dayTasks.map(t => (
                  <div key={t.id} style={{ 
                    fontSize: '0.75rem', 
                    padding: '0.2rem 0.4rem', 
                    background: 'var(--bg-column)', 
                    borderRadius: 'var(--radius-sm)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}>
                    {t.title}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
