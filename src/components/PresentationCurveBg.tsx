import styles from "./PresentationCurveBg.module.css";

export function PresentationCurveBg() {
  return (
    <div className={styles.root}>
      <svg 
        viewBox="0 0 1440 1024" 
        preserveAspectRatio="xMidYMid slice" 
        className={styles.curves}
      >
        {/* Curvas paralelas suaves do PDF */}
        <path d="M-100,512 C300,200 600,900 1540,300" fill="none" stroke="currentColor" strokeWidth="2" opacity="0.3" strokeDasharray="10 10" />
        <path d="M-100,532 C300,220 600,920 1540,320" fill="none" stroke="currentColor" strokeWidth="5" opacity="0.8" />
        <path d="M-100,552 C300,240 600,940 1540,340" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="4 12" opacity="0.5" />
        
        {/* Seta no final da linha central */}
        <path d="M1490,340 L1540,320 L1500,380" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" opacity="0.8" />
        
        {/* Elementos secundários */}
        <circle cx="150" cy="800" r="4" fill="currentColor" opacity="0.4" />
        <circle cx="1200" cy="150" r="6" fill="currentColor" opacity="0.4" />
        <path d="M1100,100 L1120,120 M1120,100 L1100,120" stroke="currentColor" strokeWidth="2" opacity="0.3" strokeLinecap="round" />
      </svg>
    </div>
  );
}
