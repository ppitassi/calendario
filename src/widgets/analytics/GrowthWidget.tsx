import React from 'react';
import { LineChart, Line, XAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { WidgetState, Platform } from './types';

interface GrowthWidgetProps {
   data: any[];
   state: WidgetState;
   platforms: Platform[];
}

export const GrowthWidget = ({ data, state, platforms }: GrowthWidgetProps) => (
   <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data}>
         <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
         <XAxis dataKey="date" hide />
         <Tooltip contentStyle={{ backgroundColor: 'rgba(0,0,0,0.8)', borderRadius: '1.5rem', border: 'none', color: '#fff' }} />
         {state.platforms.map(pId => {
            const p = platforms.find(pl => pl.id === pId);
            return p ? <Line key={p.id} type="monotone" dataKey={`${p.id}_growth`} stroke={p.color} strokeWidth={3} dot={false} /> : null;
         })}
      </LineChart>
   </ResponsiveContainer>
);
