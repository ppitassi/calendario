import React, { useMemo } from 'react';
import { motion } from 'motion/react';
import styles from './BackgroundEffects.module.css';

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
    <div className={styles.root} aria-hidden="true">
      {/* Blurs */}
      <motion.div 
        animate={{ 
          x: ['-10%', '5%', '-10%'], 
          y: ['-10%', '5%', '-10%'],
          scale: [1, 1.1, 1] 
        }} 
        transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
        className={`${styles.blur} ${styles.blurPrimary}`}
      />
      <motion.div 
        animate={{ 
          x: ['10%', '-5%', '10%'], 
          y: ['10%', '-5%', '10%'],
          scale: [1.1, 1, 1.1] 
        }} 
        transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
        className={`${styles.blur} ${styles.blurSecondary}`}
      />
      
      {/* Asterisks */}
      {asterisks.map((ast, i) => (
        <motion.div
          key={i}
          className={styles.asterisk}
          style={{
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
