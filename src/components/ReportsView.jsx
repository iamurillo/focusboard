import { useEffect, useState } from 'react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

const COLORS = ['#6366f1', '#f59e0b', '#10b981'];

export default function ReportsView({ tasks, columns }) {
  const [quote, setQuote] = useState('');

  useEffect(() => {
    // Motivational Quote API
    fetch('https://api.quotable.io/random?tags=technology,inspirational')
      .then(res => res.json())
      .then(data => setQuote(`${data.content} - ${data.author}`))
      .catch(() => setQuote('El enfoque es la clave del éxito.'));
  }, []);

  const allTasks = Object.values(tasks);
  
  // Data for Column Pie Chart
  const columnData = Object.values(columns).map(col => ({
    name: col.title,
    value: col.taskIds.length
  }));

  // Data for Priority Bar Chart
  const priorityCount = { low: 0, medium: 0, high: 0 };
  allTasks.forEach(t => { if (priorityCount[t.priority] !== undefined) priorityCount[t.priority]++ });
  const priorityData = [
    { name: 'Baja', Tareas: priorityCount.low },
    { name: 'Media', Tareas: priorityCount.medium },
    { name: 'Alta', Tareas: priorityCount.high },
  ];

  return (
    <div className="reports-container">
      <div className="quote-card">
        <p>"{quote}"</p>
      </div>

      <div className="charts-grid">
        <div className="chart-card">
          <h3>Estado de Tareas</h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie data={columnData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} fill="#8884d8" label>
                {columnData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-card">
          <h3>Tareas por Prioridad</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={priorityData}>
              <XAxis dataKey="name" stroke="#94a3b8" />
              <YAxis stroke="#94a3b8" />
              <Tooltip cursor={{fill: 'rgba(255,255,255,0.05)'}} />
              <Bar dataKey="Tareas" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
