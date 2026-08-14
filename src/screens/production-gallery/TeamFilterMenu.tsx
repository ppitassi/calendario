import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { Check, Filter, X } from "lucide-react";
import { UserProfile } from "../../types";
import { Button } from "../../components/ui/Button/Button";
import { IconButton } from "../../components/ui/IconButton/IconButton";
import styles from "./TeamFilterMenu.module.css";

type TeamFilterMenuProps = {
  members: UserProfile[];
  selected: string[];
  onChange: (ids: string[]) => void;
};

export function TeamFilterMenu({
  members,
  selected,
  onChange,
}: TeamFilterMenuProps) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ left: 0, top: 0, width: 288 });

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    const menu = menuRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const width = Math.min(288, window.innerWidth - 24);
    const height = menu?.offsetHeight || 256;
    const gap = 8;

    let left = rect.left;
    if (left + width > window.innerWidth - 12) {
      left = Math.max(12, window.innerWidth - width - 12);
    }
    let top = rect.bottom + gap;
    if (top + height > window.innerHeight - 12) {
      top = Math.max(12, rect.top - height - gap);
    }

    setPosition({ left: Math.round(left), top: Math.round(top), width });
  }, []);

  useLayoutEffect(() => {
    if (open) updatePosition();
  }, [open, updatePosition, selected.length]);

  useEffect(() => {
    if (!open) return;
    const handleScrollOrResize = () => updatePosition();
    window.addEventListener("resize", handleScrollOrResize);
    window.addEventListener("scroll", handleScrollOrResize, true);
    return () => {
      window.removeEventListener("resize", handleScrollOrResize);
      window.removeEventListener("scroll", handleScrollOrResize, true);
    };
  }, [open, updatePosition]);

  const toggle = (id: string) => {
    onChange(
      selected.includes(id)
        ? selected.filter((item) => item !== id)
        : [...selected, id],
    );
  };

  return (
    <>
      <Button
        ref={triggerRef}
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((value) => !value)}
        variant="glass"
        size="small"
        icon={<Filter />}
      >
        <span>Equipe</span>
        {selected.length > 0 && (
          <span className={styles.count}>
            {selected.length}
          </span>
        )}
      </Button>

      {open &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            aria-label="Filtrar por responsável"
            style={{
              left: `${position.left}px`,
              top: `${position.top}px`,
              width: `${position.width}px`,
            }}
            className={styles.menu}
          >
            <div className={styles.header}>
              <span className={styles.title}>Filtrar por Responsável</span>
              <IconButton
                label="Fechar filtro de equipe"
                onClick={() => setOpen(false)}
                size="small"
              >
                <X />
              </IconButton>
            </div>
            <div className={styles.members}>
              {members.map((m) => {
                const isSelected = selected.includes(m.uid);
                return (
                  /* style-architecture-button-exception: multi-select menu rows implement menuitemcheckbox semantics. */
                  <button
                    type="button"
                    role="menuitemcheckbox"
                    aria-checked={isSelected}
                    key={m.uid}
                    onClick={() => toggle(m.uid)}
                    className={styles.memberItem}
                  >
                    <span className={styles.memberName}>{m.displayName || m.uid}</span>
                    {isSelected && <Check className={styles.check} />}
                  </button>
                );
              })}
            </div>
            {selected.length > 0 && (
              <Button
                onClick={() => onChange([])}
                className="mt-2 w-full"
                size="small"
                variant="danger"
              >
                Limpar seleção
              </Button>
            )}
          </div>,
          document.body,
        )}
    </>
  );
}
