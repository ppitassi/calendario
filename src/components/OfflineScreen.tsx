import { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { RefreshCw, PowerOff } from 'lucide-react';
import { Button } from './ui/Button/Button';
import { Modal } from './ui/Modal/Modal';
import styles from './OfflineScreen.module.css';

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
      onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); handleJump(); } }}
      role="button"
      tabIndex={0}
      aria-label="Jogo offline: clique ou pressione espaço para pular"
      className={styles.game}
    >
      <div className={styles.score}>
        {score}
      </div>
      
      {/* O "Dino" (Bolinha) */}
      <motion.div 
        animate={{ y: isJumping ? -60 : 0 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
        className={styles.player}
      />

      {/* Obstáculo */}
      <div 
        style={{ left: `${obstaclePos}%` }}
        className={styles.obstacle}
      />

      <div className={styles.gameMessage}>
        {isGameOver && (
          <motion.div initial={{ scale: 0.5 }} animate={{ scale: 1 }}>
            <p data-danger="true">Game Over</p>
            <p>Aperte ESPAÇO para reiniciar</p>
          </motion.div>
        )}
        {!isGameOver && score === 0 && (
          <p>Aperte ESPAÇO ou Clique para Pular</p>
        )}
      </div>
      
      <div className={styles.ground} />
    </div>
  );
}

export function OfflineScreen() {
  return (
    <Modal open onClose={() => undefined} dismissible={false} className={styles.dialog}>
      <div className={styles.content}>
        <div className={styles.offlineIcon}>
          <PowerOff />
        </div>

        <h1>Servidor Dormindo... 😴</h1>
        <p className={styles.description}>
          Parece que o seu backend (MySQL Bridge) não está respondendo. 
          Ligue o <strong>run_server.bat</strong> para voltar ao trabalho!
        </p>

        {/* ÁREA DO JOGO - Agora isolada em seu próprio componente para evitar re-renders do backdrop-blur */}
        <DinoGame />

        <Button
          onClick={() => window.location.reload()}
          className="mt-8 mx-auto"
          variant="glass"
          icon={<RefreshCw />}
        >
          Tentar Reconectar
        </Button>
      </div>
    </Modal>
  );
}
