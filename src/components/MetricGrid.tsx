import React from 'react';
import type { MetricGridProps } from '../types';

/**
 * MetricGrid Component
 * 
 * Displays key performance indicators in a grid layout.
 * Numbers use Space Mono for that data-forward aesthetic.
 */
export const MetricGrid: React.FC<MetricGridProps> = ({
  stats,
  columns = 3,
  variant = 'default',
}) => {
  if (!stats || stats.length === 0) return null;
  
  const gridCols = {
    2: 'grid-cols-2',
    3: 'grid-cols-2 md:grid-cols-3',
    4: 'grid-cols-2 md:grid-cols-4',
  };
  
  const variantStyles = {
    default: {
      container: 'bg-gray-50 rounded-xl p-6',
      card: 'text-center p-4',
      value: 'text-[#1A1818]',
      label: 'text-gray-600',
    },
    highlight: {
      container: 'bg-[#1A1818] rounded-xl p-6',
      card: 'text-center p-4',
      value: 'text-[#3FD9A3]',
      label: 'text-white/70',
    },
    minimal: {
      container: 'border border-gray-200 rounded-xl p-6',
      card: 'text-center p-4',
      value: 'text-[#1A1818]',
      label: 'text-gray-500',
    },
  };
  
  const styles = variantStyles[variant];
  
  return (
    <div className={styles.container}>
      <div className={`grid ${gridCols[columns]} gap-4`}>
        {stats.map((stat, index) => (
          <div 
            key={index} 
            className={styles.card}
          >
            {/* Value - big and bold */}
            <div className={`
              font-mono text-2xl md:text-3xl lg:text-4xl font-bold mb-2
              ${styles.value}
            `}>
              {stat.value}
            </div>
            
            {/* Label */}
            <div className={`
              text-xs md:text-sm uppercase tracking-wider
              ${styles.label}
            `}>
              {stat.label}
            </div>
            
            {/* Context (optional) */}
            {stat.context && (
              <p className={`
                text-xs mt-2 opacity-60
                ${styles.label}
              `}>
                {stat.context}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default MetricGrid;
