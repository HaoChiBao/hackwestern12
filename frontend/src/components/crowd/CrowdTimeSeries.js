import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const CrowdTimeSeries = ({ history }) => {
  if (!history || history.length === 0) return <div className="panel" style={{ height: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>No Data</div>;

  const formattedHistory = history.map(h => ({
    ...h,
    timeStr: new Date(h.timestamp).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    densityPct: (h.globalDensity * 100).toFixed(1)
  }));

  return (
    <div className="panel" style={{ padding: '1rem', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <h3 style={{ fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase', marginBottom: '1rem' }}>Global Density Trend</h3>
      <div style={{ flex: 1, minHeight: '150px' }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={formattedHistory}>
            <defs>
              <linearGradient id="colorGlobalDensity" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--text-primary)" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="var(--text-primary)" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
            <XAxis 
              dataKey="timeStr" 
              stroke="var(--text-secondary)" 
              fontSize={10} 
              tickLine={false} 
              axisLine={false}
              interval="preserveStartEnd"
              minTickGap={30}
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
              labelStyle={{ color: 'var(--text-secondary)' }}
            />
            <Area 
              type="monotone" 
              dataKey="densityPct" 
              stroke="var(--text-primary)" 
              strokeWidth={2}
              fillOpacity={1} 
              fill="url(#colorGlobalDensity)" 
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default CrowdTimeSeries;
