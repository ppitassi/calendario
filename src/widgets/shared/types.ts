import React from 'react';import {LucideIcon} from 'lucide-react';
export type WidgetCategory='COMMUNICATION'|'PRODUCTION'|'MANAGEMENT'|'PRODUCTIVITY';
export type WidgetSize='compact'|'medium'|'wide';
export interface WidgetLayout{id:string;x?:number;y?:number;w?:number;h?:number;isHidden:boolean;zIndex?:number;position?:number;size?:WidgetSize}
export interface WidgetConfig{id:string;title:string;description?:string;icon:LucideIcon;category:WidgetCategory;component:React.ComponentType<any>;placement?:'section'|'complementary';defaultLayout?:Partial<WidgetLayout>;allowedSizes?:WidgetSize[];defaultSize?:WidgetSize;requiredCapability?:string;removable?:boolean;allowMultiple?:boolean;rolesSuggested?:string[]}
export interface WidgetState{dateRange:string;platforms:string[];[key:string]:any}
