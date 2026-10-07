import React from "react";
import {
  Sparkles,
  Clock,
  Eye,
  CheckCircle2,
  Layers,
  Smartphone,
  Library,
  Film,
  FileImage,
} from "lucide-react";
import type { ContentStatus, ContentType } from "../../lib/types";

export const STATUS_COLUMNS: {
  id: ContentStatus;
  label: string;
  color: string;
  bgLight: string;
  borderLight: string;
  icon: React.ComponentType<{ size?: number; className?: string; style?: React.CSSProperties }>;
}[] = [
  {
    id: "Ideia",
    label: "Ideia",
    color: "#6366f1",
    bgLight: "rgba(99, 102, 241, 0.08)",
    borderLight: "rgba(99, 102, 241, 0.25)",
    icon: Sparkles,
  },
  {
    id: "Produção",
    label: "Em Produção",
    color: "#0284c7",
    bgLight: "rgba(2, 132, 199, 0.08)",
    borderLight: "rgba(2, 132, 199, 0.25)",
    icon: Clock,
  },
  {
    id: "Revisão",
    label: "Em Revisão",
    color: "#d97706",
    bgLight: "rgba(217, 119, 6, 0.08)",
    borderLight: "rgba(217, 119, 6, 0.25)",
    icon: Eye,
  },
  {
    id: "Aprovado",
    label: "Aprovado",
    color: "#16a34a",
    bgLight: "rgba(22, 163, 74, 0.08)",
    borderLight: "rgba(22, 163, 74, 0.25)",
    icon: CheckCircle2,
  },
];

export const FORMAT_OPTIONS: ContentType[] = [
  "Feed e Story",
  "Feed",
  "Story",
  "Carrossel",
  "Reels",
];

export const FUNNEL_OPTIONS: ("Topo" | "Meio" | "Fundo")[] = ["Topo", "Meio", "Fundo"];

export const STATUS_OPTIONS: ContentStatus[] = ["Ideia", "Produção", "Revisão", "Aprovado"];

export function getFormatIcon(type: ContentType) {
  switch (type) {
    case "Feed e Story":
      return <Layers size={13} />;
    case "Story":
      return <Smartphone size={13} />;
    case "Carrossel":
      return <Library size={13} />;
    case "Reels":
      return <Film size={13} />;
    default:
      return <FileImage size={13} />;
  }
}

export function formatDateBadge(dateStr: string) {
  if (!dateStr) return "";
  const parts = dateStr.split("-");
  if (parts.length < 3) return dateStr;
  const day = parts[2];
  const monthIndex = parseInt(parts[1], 10) - 1;
  const months = [
    "Jan",
    "Fev",
    "Mar",
    "Abr",
    "Mai",
    "Jun",
    "Jul",
    "Ago",
    "Set",
    "Out",
    "Nov",
    "Dez",
  ];
  return `${day} ${months[monthIndex] || ""}`;
}
