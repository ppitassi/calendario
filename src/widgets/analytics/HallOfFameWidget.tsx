import React from 'react';
import { Globe, Image as ImageIcon } from 'lucide-react';
import { Platform } from './types';

interface HallOfFameWidgetProps {
   data: any[];
   platforms: Platform[];
}

export const HallOfFameWidget = ({ data, platforms }: HallOfFameWidgetProps) => (
   <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mt-4">
      {data.filter(d => d.type === 'top').slice(0, 4).map((post, idx) => (
         <div key={idx} className="flex flex-col gap-4 p-6 rounded-[2.5rem] bg-black/20 dark:bg-white/5 border border-white/5 group/post hover:border-primary/50 transition-all cursor-pointer">
            <div className="aspect-video rounded-[1.5rem] bg-black/40 overflow-hidden relative">
               {post.thumbnail ? <img src={post.thumbnail} className="w-full h-full object-cover transition-transform group-hover/post:scale-110" /> : <div className="w-full h-full flex items-center justify-center opacity-20"><ImageIcon className="w-8 h-8" /></div>}
               <div className="absolute top-3 right-3 p-2 bg-black/60 backdrop-blur-md rounded-xl border border-white/10">
                  {React.createElement(platforms.find(p => p.id === post.platform)?.icon || Globe, { className: "w-4 h-4", style: { color: platforms.find(p => p.id === post.platform)?.color } })}
               </div>
            </div>
            <div>
               <p className="text-xs font-black uppercase opacity-30 mb-2">{post.platform} • Top Content</p>
               <h4 className="text-sm font-bold truncate mb-3">{post.title}</h4>
               <div className="flex items-center justify-between p-3 rounded-2xl bg-white/5">
                  <div className="text-center">
                     <p className="text-[10px] font-black text-primary">{post.engagementRate}%</p>
                     <p className="text-[8px] opacity-30 uppercase font-black">ER</p>
                  </div>
                  <div className="w-px h-6 bg-white/10" />
                  <div className="text-center">
                     <p className="text-[10px] font-black text-primary">{post.reach}</p>
                     <p className="text-[8px] opacity-30 uppercase font-black">Reach</p>
                  </div>
               </div>
            </div>
         </div>
      ))}
   </div>
);
