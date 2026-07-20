import React from 'react';
import { ScatterChart, Scatter, XAxis, YAxis, ZAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { WidgetState, Platform } from './types';

interface PrimeTimeWidgetProps {
   data: any[];
   state: WidgetState;
   platforms: Platform[];
}

export const PrimeTimeWidget = ({ data, state, platforms }: PrimeTimeWidgetProps) => (
   <ResponsiveContainer width="100%" height="100%">
      <ScatterChart>
         <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
         <XAxis type="number" dataKey="hour" name="Hora" unit="h" axisLine={false} tickLine={false} tick={{ fontSize: 10, opacity: 0.4 }} domain={[0, 23]} />
         <YAxis type="number" dataKey="engagement" axisLine={false} tickLine={false} tick={{ fontSize: 10, opacity: 0.4 }} />
         <ZAxis type="number" dataKey="volume" range={[50, 400]} />
         <Tooltip cursor={{ strokeDasharray: '3 3' }} contentStyle={{ backgroundColor: 'rgba(0,0,0,0.8)', borderRadius: '1.5rem', border: 'none', color: '#fff' }} />
         {state.platforms.map(pId => {
            const p = platforms.find(pl => pl.id === pId);
            return p ? <Scatter key={p.id} name={p.label} data={data.filter(d => d.platform === p.id)} fill={p.color} /> : null;
         })}
      </ScatterChart>
   </ResponsiveContainer>
);
