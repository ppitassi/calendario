import React from 'react';
import { ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { WidgetState, Platform } from './types';

interface VideoWidgetProps {
   data: any[];
}

export const VideoWidget = ({ data }: VideoWidgetProps) => (
   <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={data.filter(d => d.type === 'video')}>
         <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
         <XAxis dataKey="platform" axisLine={false} tickLine={false} tick={{ fontSize: 10, opacity: 0.4 }} />
         <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, opacity: 0.4 }} />
         <Tooltip contentStyle={{ backgroundColor: 'rgba(0,0,0,0.8)', borderRadius: '1.5rem', border: 'none', color: '#fff' }} />
         <Bar dataKey="views" fill="#8b5cf6" radius={[6, 6, 0, 0]} />
         <Line type="monotone" dataKey="retention" stroke="#ec4899" strokeWidth={3} dot={false} />
      </ComposedChart>
   </ResponsiveContainer>
);
