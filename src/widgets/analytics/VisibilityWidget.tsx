import React from 'react';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { WidgetState, Platform } from './types';

interface VisibilityWidgetProps {
   data: any[];
   state: WidgetState;
   platforms: Platform[];
}

export const VisibilityWidget = ({ data, state, platforms }: VisibilityWidgetProps) => (
   <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data}>
         <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
         <XAxis dataKey="date" hide />
         <Tooltip contentStyle={{ backgroundColor: 'rgba(0,0,0,0.8)', borderRadius: '1.5rem', border: 'none', color: '#fff' }} />
         {state.platforms.map(pId => {
            const p = platforms.find(pl => pl.id === pId);
            return p ? <Bar key={p.id} dataKey={`${p.id}_reach`} name={p.label} fill={p.color} radius={[6, 6, 0, 0]} /> : null;
         })}
      </BarChart>
   </ResponsiveContainer>
);
