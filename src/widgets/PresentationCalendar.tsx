import { useState } from 'react';
import { getDaysInMonth, startOfMonth, getDay, format } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowUpRight, ImageIcon, Clock } from 'lucide-react';
import { DAY_NAMES, POST_TYPES } from '../lib/constants';
import { PostData } from '../types';
import { Button } from '../components/ui/Button/Button';
import styles from './PresentationCalendar.module.css';

interface PresentationCalendarProps {
  currentDate: Date;
  posts: Record<string, PostData>;
}

export function PresentationCalendar({ currentDate, posts }: PresentationCalendarProps) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const handleDayClick = (dateStr: string) => {
    const postEntry = Object.entries(posts).find(([key, post]) => (post.date || key.split("#")[0]) === dateStr);
    if (postEntry) {
      setSelectedDate(dateStr === selectedDate ? null : dateStr);
    }
  };

  const scrollToPost = (dateStr: string) => {
    const post = Object.entries(posts).find(([key, item]) => (item.date || key.split("#")[0]) === dateStr)?.[1];
    const element = document.getElementById(`post-${post?.id || dateStr}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
      setSelectedDate(null);
    }
  };

  return (
    <div className={`print-calendar ${styles.root}`}>
      <div className={styles.heading}>
         <p>Visão Macro</p>
         <h2>Calendário Mensal</h2>
      </div>

      <div className={styles.calendarCard}>
         <div className="grid grid-cols-7 gap-2 md:gap-4 max-w-2xl mx-auto relative">
            {DAY_NAMES.map(name => <div key={name} className={styles.dayName}>{name}</div>)}
            
            {Array.from({ length: getDay(startOfMonth(currentDate)) }).map((_, i) => (
              <div key={`pre-${i}`} className={styles.emptyDay} />
            ))}
            
            {Array.from({ length: getDaysInMonth(currentDate) }).map((_, i) => {
               const day = i + 1;
               const dateStr = format(new Date(currentDate.getFullYear(), currentDate.getMonth(), day), 'yyyy-MM-dd');
               const post = Object.entries(posts).find(([key, item]) => (item.date || key.split("#")[0]) === dateStr)?.[1];
               const postTypeConfig = post ? POST_TYPES.find(pt => pt.id === post.type) : null;
               const Icon = postTypeConfig?.icon;
               const isSelected = selectedDate === dateStr;

               return (
                  <div key={day} className="relative">
                    {/* style-architecture-button-exception: presentation calendar days are feature-specific navigable records. */}
                    <motion.button 
                      onClick={() => handleDayClick(dateStr)}
                      whileHover={post ? { scale: 1.05, y: -2 } : {}}
                      whileTap={post ? { scale: 0.95 } : {}}
                      className={styles.day}
                      data-has-post={Boolean(post) || undefined}
                      data-selected={isSelected || undefined}
                    >
                       <span>{day}</span>
                       {post?.deadline && (
                          <div className={styles.dayDeadline}>
                             <Clock />
                          </div>
                       )}
                       {post && Icon && (
                          <div className={styles.dayType}>
                             <Icon />
                          </div>
                       )}
                    </motion.button>

                    {/* Popover Card surgindo de cima do botão */}
                    <AnimatePresence>
                      {isSelected && post && (
                        <motion.div
                          initial={{ opacity: 0, y: 10, scale: 0.9, x: '-50%' }}
                          animate={{ opacity: 1, y: -10, scale: 1, x: '-50%' }}
                          exit={{ opacity: 0, y: 10, scale: 0.9, x: '-50%' }}
                          className={styles.popover}
                        >
                          {/* Post Image Preview */}
                          <div className={styles.preview}>
                            {post.feedImages && post.feedImages.length > 0 ? (
                              <img src={post.feedImages[0]} alt="Preview" />
                            ) : (
                              <div className={styles.previewEmpty}>
                                <ImageIcon />
                              </div>
                            )}
                            <div className={styles.typeBadge}>
                               {postTypeConfig?.label || 'Post'}
                            </div>
                          </div>

                          <div className={styles.popoverCopy}>
                            <h4>{post.head || 'Sem título'}</h4>
                            {(post.subhead || post.theme) && <p>{post.subhead || post.theme}</p>}
                            {post.deadline && (
                              <div className={styles.deadlineBadge}>
                                <Clock />
                                <span>
                                  Prazo: {(() => {
                                    try {
                                      const d = post.deadline;
                                      if (typeof d === 'number') {
                                        return format(new Date(d), 'dd/MM/yyyy');
                                      }
                                      if (typeof d === 'string') {
                                        if (d.includes('T')) {
                                          return format(new Date(d), 'dd/MM/yyyy');
                                        }
                                        return format(new Date(d + 'T00:00:00'), 'dd/MM/yyyy');
                                      }
                                      return format(new Date(d), 'dd/MM/yyyy');
                                    } catch (e) {
                                      return 'Inválido';
                                    }
                                  })()}
                                </span>
                              </div>
                            )}
                          </div>

                          <Button
                            onClick={(e) => {
                               e.stopPropagation();
                               scrollToPost(dateStr);
                            }}
                            className="w-full"
                            variant="primary"
                            size="small"
                            icon={<ArrowUpRight />}
                          >
                            VER POST COMPLETO
                          </Button>

                          {/* Arrow pointing down to the button */}
                          <div className={styles.arrow} />
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
               );
            })}
         </div>

         {/* Overlay to close when clicking outside */}
         {selectedDate && (
           <div 
             className={styles.closeLayer}
             onClick={() => setSelectedDate(null)} 
           />
         )}
      </div>
    </div>
  );
}
