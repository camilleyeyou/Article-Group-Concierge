/**
 * Article Group AI Concierge - Component Registry
 * 
 * This is the central registry that maps component names from the
 * orchestrator's JSON layout plan to actual React components.
 * 
 * The orchestrator outputs layout plans like:
 * { "layout": [{ "component": "HeroBlock", "props": {...} }] }
 * 
 * The LayoutRenderer uses this registry to dynamically render
 * the appropriate component for each layout item.
 */

import { HeroBlock } from './HeroBlock';
import { StrategyCard } from './StrategyCard';
import { VideoPlayer } from './VideoPlayer';
import { MetricGrid } from './MetricGrid';
import { VisualAsset } from './VisualAsset';
import { CaseStudyTeaser } from './CaseStudyTeaser';

import type { ComponentType } from '../types';

// Component registry mapping
export const ComponentRegistry: Record<ComponentType, React.ComponentType<any>> = {
  HeroBlock,
  StrategyCard,
  VideoPlayer,
  MetricGrid,
  VisualAsset,
  CaseStudyTeaser,
};

// Export individual components for direct imports
export {
  HeroBlock,
  StrategyCard,
  VideoPlayer,
  MetricGrid,
  VisualAsset,
  CaseStudyTeaser,
};

// Type guard to check if a component name is valid
export const isValidComponent = (name: string): name is ComponentType => {
  return name in ComponentRegistry;
};

// Get component by name with type safety
export const getComponent = (name: ComponentType): React.ComponentType<any> | null => {
  return ComponentRegistry[name] || null;
};

// List of all available component names
export const availableComponents: ComponentType[] = [
  'HeroBlock',
  'StrategyCard', 
  'VideoPlayer',
  'MetricGrid',
  'VisualAsset',
  'CaseStudyTeaser',
];
