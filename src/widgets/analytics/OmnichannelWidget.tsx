import React from 'react';
import { AreaChart, Area, XAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { WidgetState, Platform } from './types';

interface OmnichannelWidgetProps {
   data: any[];
   state: WidgetState;
   platforms: Platform[];
}

export const OmnichannelWidget = ({ data, state, platforms }: OmnichannelWidgetProps) => (
   <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
         <defs>
            {platforms.map(p => (
               <linearGradient key={p.id} id={`grad-${p.id}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={p.color} stopOpacity={0.3}/>
                  <stop offset="95%" stopColor={p.color} stopOpacity={0}/>
               </linearGradient>
            ))}
         </defs>
         <XAxis dataKey="date" hide />
         <Tooltip 
            contentStyle={{ 
               backgroundColor: 'rgba(10,10,10,0.95)', 
               borderRadius: '2rem', 
               border: '1px solid rgba(255,255,255,0.1)', 
               backdropFilter: 'blur(20px)', 
               padding: '24px',
               boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
            }} 
         />
         <Legend 
            verticalAlign="top" 
            height={36} 
            content={(props: any) => (
               <div className="flex justify-center gap-6 mb-4">
                  {props.payload.map((entry: any, index: number) => {
                     const p = platforms.find(pl => pl.id === entry.value);
                     if (!p) return null;
                     return (
                        <div key={`item-${index}`} className="flex items-center gap-2 opacity-80 hover:opacity-100 transition-opacity">
                           <p.icon className="w-3 h-3" style={{ color: p.color }} />
                           <span className="text-[10px] font-black uppercase tracking-widest text-white/50">{p.label}</span>
                        </div>
                     );
                  })}
               </div>
            )}
         />
         {state.platforms.map(pId => {
            const p = platforms.find(pl => pl.id === pId);
            return p ? <Area key={p.id} type="monotone" dataKey={p.id} stroke={p.color} fill={`url(#grad-${p.id})`} strokeWidth={3} fillOpacity={1} dot={false} /> : null;
         })}
      </AreaChart>
   </ResponsiveContainer>
);
