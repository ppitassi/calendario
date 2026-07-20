import { LucideIcon } from 'lucide-react';

export interface WidgetState {
   dateRange: string;
   platforms: string[];
   isComparing?: boolean;
}

export interface Platform {
   id: string;
   label: string;
   icon: LucideIcon;
   color: string;
}
