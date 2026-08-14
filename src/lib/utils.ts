import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function parseLocalDate(value: string | number | Date) {
  if (value instanceof Date || typeof value === "number") return new Date(value);
  const dateOnly = value.match(/^(\d{4})-(\d{2})-(\d{2})(?:$|T00:00:00(?:\.000)?Z?$)/);
  if (!dateOnly) return new Date(value);
  return new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]), 12);
}
