/** Mantém opções fixas compartilhadas pelo editor e pela apresentação. */

import {
  Image as ImageIcon,
  LayoutTemplate,
  Video,
  Clock,
  FileText,
  DollarSign,
} from "lucide-react";

/** Rótulos na mesma ordem de `Date.getDay()`, de domingo a sábado. */
export const DAY_NAMES = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

/** Opções do seletor de formato, com identificador persistido, rótulo e ícone. */
export const POST_TYPES = [
  { id: "post", label: "Post IG", icon: ImageIcon },
  { id: "carousel", label: "Carrossel IG", icon: LayoutTemplate },
  { id: "reel", label: "Reel IG", icon: Video },
  { id: "story", label: "Story IG", icon: Clock },
  { id: "linkedin", label: "Artigo LinkedIn", icon: FileText },
  { id: "promoted", label: "Promo Paga", icon: DollarSign },
];
