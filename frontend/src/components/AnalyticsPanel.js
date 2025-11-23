import React, { useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Users, Activity, AlertCircle, List, BarChart, Clock } from 'lucide-react';

const data = [
  { time: '10:00', density: 30 },
  { time: '10:05', density: 35 },
  { time: '10:10', density: 45 },
  { time: '10:15', density: 60 },
  { time: '10:20', density: 75 },
  { time: '10:25', density: 85 },
  { time: '10:30', density: 92 },
];

const MetricCard = ({ title, value, subtext, icon: Icon, trend }) => (
  <div className="panel" style={{ padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ color: 'var(--text-secondary)', fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase' }}>{title}</span>
      <Icon size={14} style={{ color: 'var(--text-muted)' }} />
    </div>
    <div>
      <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1 }}>{value}</h3>
      <p style={{ fontSize: '0.7rem', color: trend === 'up' ? 'var(--danger)' : 'var(--success)', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '0.25rem' }}>
        {subtext}
      </p>
    </div>
  </div>
);

const AnalyticsPanel = () => {
  const [viewMode, setViewMode] = useState('chart'); // chart, list

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', height: '100%' }}>
      {/* Metrics Grid - Compact */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem' }}>
        <MetricCard 
          title="Density" 
          value="92%" 
          subtext="↑ 12%" 
          icon={Users}
          trend="up"
        />
        <MetricCard 
          title="Risk Lvl" 
          value="High" 
          subtext="Critical" 
          icon={AlertCircle}
          trend="up"
        />
        <MetricCard 
          title="Drones" 
          value="3/4" 
          subtext="Active" 
          icon={Activity}
          trend="down"
        />
        <MetricCard 
          title="Count" 
          value="1,240" 
          subtext="Est." 
          icon={Users}
          trend="up"
        />
      </div>

      {/* Main Panel */}
      <div className="panel" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ 
          padding: '0.5rem 0.75rem', 
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: 'var(--bg-tertiary)'
        }}>
          <h3 style={{ fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase' }}>Crowd Analysis</h3>
          <div style={{ display: 'flex', gap: '0.25rem' }}>
            <button 
              className={`btn ${viewMode === 'chart' ? 'btn-active' : ''}`}
              onClick={() => setViewMode('chart')}
              style={{ padding: '0.25rem' }}
            >
              <BarChart size={14} />
            </button>
            <button 
              className={`btn ${viewMode === 'list' ? 'btn-active' : ''}`}
              onClick={() => setViewMode('list')}
              style={{ padding: '0.25rem' }}
            >
              <List size={14} />
            </button>
          </div>
        </div>

        <div style={{ flex: 1, padding: '1rem', overflow: 'hidden' }}>
          {viewMode === 'chart' ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data}>
                <defs>
                  <linearGradient id="colorDensity" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--text-primary)" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="var(--text-primary)" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
                <XAxis 
                  dataKey="time" 
                  stroke="var(--text-secondary)" 
                  fontSize={10} 
                  tickLine={false} 
                  axisLine={false}
                />
                <YAxis 
                  stroke="var(--text-secondary)" 
                  fontSize={10} 
                  tickLine={false} 
                  axisLine={false}
                  tickFormatter={(value) => `${value}%`}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'var(--bg-panel)', 
                    borderColor: 'var(--border-color)',
                    borderRadius: '2px',
                    fontSize: '0.8rem'
                  }}
                  itemStyle={{ color: 'var(--text-primary)' }}
                />
                <Area 
                  type="monotone" 
                  dataKey="density" 
                  stroke="var(--text-primary)" 
                  strokeWidth={2}
                  fillOpacity={1} 
                  fill="url(#colorDensity)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ overflow: 'auto', height: '100%' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color)', textAlign: 'left' }}>
                    <th style={{ padding: '0.5rem', color: 'var(--text-secondary)' }}>Time</th>
                    <th style={{ padding: '0.5rem', color: 'var(--text-secondary)' }}>Density</th>
                    <th style={{ padding: '0.5rem', color: 'var(--text-secondary)' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((item, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '0.5rem' }}>{item.time}</td>
                      <td style={{ padding: '0.5rem' }}>{item.density}%</td>
                      <td style={{ padding: '0.5rem' }}>
                        <span className={item.density > 80 ? 'badge badge-danger' : 'badge badge-success'}>
                          {item.density > 80 ? 'CRITICAL' : 'NORMAL'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Recent Alerts - Compact List */}
      <div className="panel" style={{ height: '30%', display: 'flex', flexDirection: 'column' }}>
        <div style={{ 
          padding: '0.5rem 0.75rem', 
          borderBottom: '1px solid var(--border-color)',
          backgroundColor: 'var(--bg-tertiary)'
        }}>
          <h3 style={{ fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase' }}>System Logs</h3>
        </div>
        <div style={{ overflow: 'auto', padding: '0' }}>
          {[1, 2, 3].map((_, i) => (
            <div key={i} style={{ 
              display: 'flex', 
              gap: '0.75rem', 
              alignItems: 'center', 
              padding: '0.5rem 0.75rem',
              borderBottom: '1px solid var(--border-color)',
              fontSize: '0.8rem'
            }}>
              <Clock size={12} style={{ color: 'var(--text-muted)' }} />
              <span style={{ fontFamily: 'monospace', color: 'var(--text-secondary)' }}>10:42:0{i}</span>
              <span style={{ flex: 1, fontWeight: 500 }}>High density detected in Sector 4</span>
              <span className="badge badge-danger">ALERT</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AnalyticsPanel;
