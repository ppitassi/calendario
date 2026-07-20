import React from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';

export const AudienceWidget = () => (
   <ResponsiveContainer width="100%" height="100%">
      <PieChart>
         <Pie
            data={[
               { name: '18-24', value: 30, color: '#6366f1' },
               { name: '25-34', value: 45, color: '#8b5cf6' },
               { name: '35-44', value: 15, color: '#ec4899' },
               { name: '45+', value: 10, color: '#f43f5e' }
            ]}
            cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={5} dataKey="value" stroke="none"
         >
            {[
               { color: '#6366f1' }, { color: '#8b5cf6' }, { color: '#ec4899' }, { color: '#f43f5e' }
            ].map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
         </Pie>
         <Tooltip />
         <Legend verticalAlign="bottom" wrapperStyle={{ fontSize: '10px', fontWeight: 'black' }} />
      </PieChart>
   </ResponsiveContainer>
);
