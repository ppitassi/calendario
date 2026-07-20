import React from 'react';
import { 
  Video, 
  Image as ImageIcon, 
  FileText,
  LayoutTemplate,
  DollarSign,
  Clock
} from 'lucide-react';

import { PostType, PostData } from "../types";

export const DAYS_OF_WEEK = [0, 1, 2, 3, 4, 5, 6];

export const DAY_NAMES = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export const POST_TYPES: { id: PostType; label: string; icon: React.ElementType }[] = [
  { id: 'post', label: 'Post IG', icon: ImageIcon },
  { id: 'carousel', label: 'Carrossel IG', icon: LayoutTemplate },
  { id: 'reel', label: 'Reel IG', icon: Video },
  { id: 'story', label: 'Story IG', icon: Clock },
  { id: 'linkedin', label: 'Artigo LinkedIn', icon: FileText },
  { id: 'promoted', label: 'Promo Paga', icon: DollarSign }
];

export const DEFAULT_POST: PostData = {
  type: 'post',
  head: '',
  subhead: '',
  subtitle: '',
  objective: '',
  channel: 'Instagram',
  title: '',
  centralIdea: '',
  caption: '',
  artHeadline: '',
  artText: '',
  cta: '',
  hashtags: '',
  visualBriefing: '',
  internalNotes: '',
  theme: '',
  script: '',
  feedImages: [],
  funnelStage: 'topo'
};