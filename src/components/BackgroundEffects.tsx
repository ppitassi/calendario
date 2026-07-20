import React, { useMemo } from 'react';
import { motion } from 'motion/react';

export const BackgroundEffects = React.memo(() => {
  const asterisks = useMemo(() => {
    return Array.from({ length: 20 }).map(() => ({
      top: `${Math.random() * 100}%`,
      left: `${Math.random() * 100}%`,
      fontSize: `${Math.random() * 40 + 20}px`,
      yEnd: Math.random() * -150 - 50,
      xEnd: Math.random() * 100 - 50,
      scaleMax: Math.random() * 0.5 + 0.8,
      duration: Math.random() * 15 + 25,
      delay: Math.random() * 10
    }));
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none z-[-1] overflow-hidden select-none" aria-hidden="true">
      {/* Blurs */}
      <motion.div 
        animate={{ 
          x: ['-10%', '5%', '-10%'], 
          y: ['-10%', '5%', '-10%'],
          scale: [1, 1.1, 1] 
        }} 
        transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
        className="absolute top-0 left-0 w-[60vw] h-[60vw] rounded-full bg-[var(--color-primary)]/15 blur-[120px] mix-blend-multiply dark:mix-blend-screen"
      />
      <motion.div 
        animate={{ 
          x: ['10%', '-5%', '10%'], 
          y: ['10%', '-5%', '10%'],
          scale: [1.1, 1, 1.1] 
        }} 
        transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
        className="absolute bottom-0 right-0 w-[50vw] h-[50vw] rounded-full bg-[var(--color-primary)]/10 blur-[130px] mix-blend-multiply dark:mix-blend-screen"
      />
      
      {/* Asterisks */}
      {asterisks.map((ast, i) => (
        <motion.div
          key={i}
          className="absolute text-[var(--color-primary)] opacity-40 font-bold"
          style={{
            WebkitTextStroke: '2px var(--color-primary)',
            color: 'transparent',
            top: ast.top,
            left: ast.left,
            fontSize: ast.fontSize
          }}
          animate={{
            y: [0, ast.yEnd, 0],
            x: [0, ast.xEnd, 0],
            rotate: [0, 360],
            scale: [1, ast.scaleMax, 1],
            opacity: [0.1, 0.4, 0.1]
          }}
          transition={{
            duration: ast.duration,
            repeat: Infinity,
            ease: "linear",
            delay: ast.delay
          }}
        >
          *
        </motion.div>
      ))}
    </div>
  );
});
