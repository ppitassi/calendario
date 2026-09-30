/** Mantém opções fixas compartilhadas pelo editor e pela apresentação. */

import {
  Image as ImageIcon,
  Clock,
  Layers,
} from "lucide-react";

/** Rótulos na mesma ordem de `Date.getDay()`, de domingo a sábado. */
export const DAY_NAMES = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

/** Opções do seletor de formato, com identificador persistido, rótulo e ícone. */
export const POST_TYPES = [
  { id: "feed e story", label: "Feed e Story", icon: Layers },
  { id: "feed", label: "Feed", icon: ImageIcon },
  { id: "story", label: "Story", icon: Clock },
];

