import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { RefreshCw, PowerOff } from 'lucide-react';

function DinoGame() {
  const [score, setScore] = useState(0);
  const [isJumping, setIsJumping] = useState(false);
  const [isGameOver, setIsGameOver] = useState(false);
  const [obstaclePos, setObstaclePos] = useState(100);
  
  const gameLoopRef = useRef<number>(null);

  const handleJump = () => {
    if (isGameOver) {
      setScore(0);
      setObstaclePos(100);
      setIsGameOver(false);
      return;
    }
    if (!isJumping) {
      setIsJumping(true);
      setTimeout(() => setIsJumping(false), 500);
    }
  };

  useEffect(() => {
    if (isGameOver) return;

    const gameLoop = () => {
      setObstaclePos((prev) => {
        if (prev <= -10) {
          setScore(s => s + 1);
          return 100;
        }
        
        // Colisão simples
        if (prev > 10 && prev < 20 && !isJumping) {
          setIsGameOver(true);
        }
        
        return prev - 1.5;
      });
      gameLoopRef.current = requestAnimationFrame(gameLoop);
    };

    gameLoopRef.current = requestAnimationFrame(gameLoop);
    return () => { if (gameLoopRef.current) cancelAnimationFrame(gameLoopRef.current); };
  }, [isJumping, isGameOver]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') handleJump();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isJumping, isGameOver]);

  return (
    <div 
      onClick={handleJump}
      className="relative w-full h-40 bg-black/5 dark:bg-white/5 rounded-3xl border border-black/10 dark:border-white/10 overflow-hidden cursor-pointer group"
    >
      <div className="absolute top-4 right-6 text-2xl font-display font-bold opacity-30">
        {score}
      </div>
      
      {/* O "Dino" (Bolinha) */}
      <motion.div 
        animate={{ y: isJumping ? -60 : 0 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
        className="absolute bottom-6 left-12 w-8 h-8 bg-[var(--color-primary)] rounded-full shadow-lg shadow-[var(--color-primary)]/40"
      />

      {/* Obstáculo */}
      <div 
        style={{ left: `${obstaclePos}%` }}
        className="absolute bottom-6 w-4 h-12 bg-red-500/40 rounded-full blur-[1px]"
      />

      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        {isGameOver && (
          <motion.div initial={{ scale: 0.5 }} animate={{ scale: 1 }} className="text-center">
            <p className="text-red-500 font-bold uppercase tracking-widest text-xs mb-2">Game Over</p>
            <p className="text-[10px] opacity-40 uppercase font-bold">Aperte ESPAÇO para reiniciar</p>
          </motion.div>
        )}
        {!isGameOver && score === 0 && (
          <p className="text-[10px] opacity-20 uppercase font-bold group-hover:opacity-100 transition-opacity">Aperte ESPAÇO ou Clique para Pular</p>
        )}
      </div>
      
      <div className="absolute bottom-6 w-full h-[1px] bg-black/10 dark:bg-white/10" />
    </div>
  );
}

export function OfflineScreen() {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-md p-6 overflow-hidden">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="glass max-w-lg w-full rounded-[3rem] p-10 shadow-2xl border border-white/20 text-center relative"
      >
        <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-24 h-24 bg-red-500 rounded-full flex items-center justify-center shadow-xl shadow-red-500/20">
          <PowerOff className="w-10 h-10 text-white animate-pulse" />
        </div>

        <h1 className="text-3xl font-display font-bold mt-8 mb-4">Servidor Dormindo... 😴</h1>
        <p className="opacity-60 text-sm leading-relaxed mb-8">
          Parece que o seu backend (MySQL Bridge) não está respondendo. 
          Ligue o <span className="font-bold text-[var(--color-primary)]">run_server.bat</span> para voltar ao trabalho!
        </p>

        {/* ÁREA DO JOGO - Agora isolada em seu próprio componente para evitar re-renders do backdrop-blur */}
        <DinoGame />

        <button 
          onClick={() => window.location.reload()}
          className="mt-8 flex items-center justify-center gap-2 mx-auto px-6 py-3 rounded-full bg-white/10 hover:bg-white/20 transition-all text-sm font-bold border border-white/5"
        >
          <RefreshCw className="w-4 h-4" /> Tentar Reconectar
        </button>
      </motion.div>
    </div>
  );
}
