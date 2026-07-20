import React from 'react';
import { LucideIcon } from 'lucide-react';

export type WidgetCategory = 'COMMUNICATION' | 'PRODUCTION' | 'MANAGEMENT' | 'ANALYTICS' | 'PRODUCTIVITY';

export interface WidgetLayout {
  id: string;
  x: number; // grid units
  y: number; // grid units
  w: number; // grid units
  h: number; // grid units
  isHidden: boolean;
  zIndex: number;
}

export interface WidgetConfig {
  id: string;
  title: string;
  icon: LucideIcon;
  category: WidgetCategory;
  colorClass: string;
  component: React.ComponentType<any>;
  defaultLayout: Partial<WidgetLayout>;
}

export interface WidgetState {
  dateRange: string;
  platforms: string[];
  [key: string]: any;
}
