import React, { useMemo } from 'react';
import { ComponentRegistry, isValidComponent } from './index';
import type { LayoutPlan, LayoutComponent, ComponentType } from '../types';
import { UILogger } from '../lib/logger';
import { LayoutErrorBoundary } from './ErrorBoundary';
import { HeroSkeleton } from './HeroSkeleton';

/**
 * LayoutRenderer Component
 * 
 * The core assembly engine that takes the orchestrator's JSON layout plan
 * and renders the corresponding React components in order.
 */

interface LayoutRendererProps {
  layoutPlan: LayoutPlan;
  className?: string;
  onError?: (error: Error, component: LayoutComponent) => void;
  /** Streaming: show the reserved hero skeleton above the deck until the hero arrives. */
  pendingHero?: boolean;
  /** Streaming: slugs of instant teasers the final layout dropped; they fade out (150 ms) then leave. */
  exitingSlugs?: ReadonlySet<string>;
  /** Streaming: the dropped teaser items, rendered faded at the end of the last teaser group. */
  exiting?: LayoutComponent[];
}

// Error boundary wrapper for individual components
interface ComponentWrapperProps {
  item: LayoutComponent;
  index: number;
  onError?: (error: Error, component: LayoutComponent) => void;
}

const ComponentWrapper: React.FC<ComponentWrapperProps> = ({ 
  item, 
  index,
  onError 
}) => {
  const { component, props } = item;
  
  // Validate component exists
  if (!isValidComponent(component)) {
    UILogger.warn('Unknown component', { component });
    return (
      <div className="p-4 rounded-lg border border-dashed border-gray-300 bg-gray-50 text-gray-500 text-center text-sm">
        Unknown component: <code className="font-mono">{component}</code>
      </div>
    );
  }
  
  const Component = ComponentRegistry[component as ComponentType];

  try {
    return (
      <LayoutErrorBoundary>
        <Component {...props} />
      </LayoutErrorBoundary>
    );
  } catch (error) {
    UILogger.error('Error rendering component', error, { component });
    onError?.(error as Error, item);

    return (
      <div className="p-4 rounded-lg border border-red-200 bg-red-50 text-red-600 text-center text-sm">
        Error rendering: <code className="font-mono">{component}</code>
      </div>
    );
  }
};

// Spacing configuration for different component combinations
const getSpacingClass = (
  current: ComponentType, 
  next: ComponentType | undefined
): string => {
  // Hero blocks get medium bottom spacing
  if (current === 'HeroBlock') {
    return 'mb-6';
  }
  
  // Metrics followed by visuals get extra spacing
  if (current === 'MetricGrid' && next === 'VisualAsset') {
    return 'mb-6';
  }
  
  // Strategy cards in sequence get tighter spacing
  if (current === 'StrategyCard' && next === 'StrategyCard') {
    return 'mb-3';
  }
  
  // Case study teasers in a row
  if (current === 'CaseStudyTeaser' && next === 'CaseStudyTeaser') {
    return 'mb-4';
  }
  
  // Default spacing
  return 'mb-5';
};

export const LayoutRenderer: React.FC<LayoutRendererProps> = ({
  layoutPlan,
  className = '',
  onError,
  pendingHero = false,
  exitingSlugs,
  exiting,
}) => {
  // Memoize the rendered layout for performance
  const renderedLayout = useMemo(() => {
    const layout = layoutPlan?.layout ?? [];
    const exitingItems = exiting ?? [];
    const showSkeleton = pendingHero && layout[0]?.component !== 'HeroBlock';
    const nodes: React.ReactNode[] = [];

    if (showSkeleton) {
      nodes.push(
        <div key="hero" className="mb-6">
          <HeroSkeleton />
        </div>
      );
    }

    if (layout.length === 0 && exitingItems.length === 0) {
      if (!showSkeleton) {
        return (
          <div className="py-8 text-center text-gray-500">
            <p className="text-sm">No content to display</p>
          </div>
        );
      }
      return nodes;
    }

    // Group case study teasers together for grid layout
    const groupedLayout: Array<LayoutComponent | LayoutComponent[]> = [];
    let currentTeaserGroup: LayoutComponent[] = [];

    layout.forEach((item, index) => {
      if (item.component === 'CaseStudyTeaser') {
        currentTeaserGroup.push(item);
        // Check if next is not a teaser or we're at the end
        const nextItem = layout[index + 1];
        if (!nextItem || nextItem.component !== 'CaseStudyTeaser') {
          groupedLayout.push([...currentTeaserGroup]);
          currentTeaserGroup = [];
        }
      } else {
        groupedLayout.push(item);
      }
    });

    // Exiting teasers stay mounted (same keys) at the end of the last teaser group while they fade out
    if (exitingItems.length > 0) {
      let lastGroup = -1;
      groupedLayout.forEach((g, i) => {
        if (Array.isArray(g)) lastGroup = i;
      });
      if (lastGroup >= 0) {
        groupedLayout[lastGroup] = [...(groupedLayout[lastGroup] as LayoutComponent[]), ...exitingItems];
      } else {
        groupedLayout.push([...exitingItems]);
      }
    }

    let teaserGroups = 0;
    const typeCounts: Record<string, number> = {};

    groupedLayout.forEach((item, index) => {
      // Handle teaser groups - use AG-style grid
      if (Array.isArray(item)) {
        const groupKey = `teaser-group-${teaserGroups++}`;
        // Determine grid layout based on number of items
        const gridClass = item.length === 1
          ? 'grid grid-cols-1'
          : item.length === 2
            ? 'grid grid-cols-1 md:grid-cols-2 gap-6'
            : 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6';

        return nodes.push(
          <div
            key={groupKey}
            className={`${gridClass} mb-8`}
          >
            {item.map((teaser, i) => {
              const slug = (teaser.props as { slug?: string }).slug ?? `i${i}`;
              const isExiting = !!exitingSlugs?.has(slug) && exitingItems.includes(teaser);
              return (
                <div
                  key={`teaser-${slug}`}
                  className={isExiting ? 'transition-opacity duration-150 opacity-0' : undefined}
                  aria-hidden={isExiting ? 'true' : undefined}
                >
                  <ComponentWrapper
                    item={teaser}
                    index={i}
                    onError={onError}
                  />
                </div>
              );
            })}
          </div>
        );
      }

      // Handle single components
      const nextItem = groupedLayout[index + 1];
      const nextComponent = Array.isArray(nextItem) ? 'CaseStudyTeaser' : nextItem?.component;
      const spacingClass = getSpacingClass(item.component, nextComponent as ComponentType);
      const isLast = index === groupedLayout.length - 1;
      const isHero = item.component === 'HeroBlock';
      const k = typeCounts[item.component] ?? 0;
      typeCounts[item.component] = k + 1;
      const wrapperKey = isHero && k === 0 ? 'hero' : `${item.component}-${k}`;
      const classes = [!isLast ? spacingClass : '', isHero ? '' : 'animate-fade-in'].filter(Boolean).join(' ');

      nodes.push(
        <div
          key={wrapperKey}
          className={classes || undefined}
        >
          <ComponentWrapper
            item={item}
            index={index}
            onError={onError}
          />
        </div>
      );
    });

    return nodes;
  }, [layoutPlan, onError, pendingHero, exitingSlugs, exiting]);

  return (
    <div
      className={`pitch-deck-layout ${className}`}
      role="region"
      aria-label="Personalized pitch deck"
    >
      {renderedLayout}
    </div>
  );
};

export default LayoutRenderer;
