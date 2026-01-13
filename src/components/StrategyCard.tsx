import React from 'react';
import type { StrategyCardProps } from '../types';

/**
 * StrategyCard Component
 * 
 * Displays strategic insights, approaches, or key points.
 * Can be used individually or in a series.
 */

const iconMap = {
  lightbulb: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
    </svg>
  ),
  target: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  ),
  chart: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  ),
  users: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  ),
  rocket: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
    </svg>
  ),
};

const accentColors: Record<string, string> = {
  coral: 'border-[#F96A63] bg-[#F96A63]/5',
  teal: 'border-[#0097A7] bg-[#0097A7]/5',
  green: 'border-[#3FD9A3] bg-[#3FD9A3]/5',
  blue: 'border-[#407CD1] bg-[#407CD1]/5',
  purple: 'border-[#B47BD5] bg-[#B47BD5]/5',
  default: 'border-gray-200 bg-white',
};

const iconColors: Record<string, string> = {
  coral: 'text-[#F96A63] bg-[#F96A63]/10',
  teal: 'text-[#0097A7] bg-[#0097A7]/10',
  green: 'text-[#3FD9A3] bg-[#3FD9A3]/10',
  blue: 'text-[#407CD1] bg-[#407CD1]/10',
  purple: 'text-[#B47BD5] bg-[#B47BD5]/10',
  default: 'text-[#1A1818] bg-gray-100',
};

export const StrategyCard: React.FC<StrategyCardProps> = ({
  title,
  content,
  icon = 'lightbulb',
  accentColor = 'default',
}) => {
  const IconComponent = iconMap[icon] || iconMap.lightbulb;
  const borderClass = accentColors[accentColor] || accentColors.default;
  const iconClass = iconColors[accentColor] || iconColors.default;
  
  return (
    <div className={`
      rounded-xl border-l-4 p-5
      ${borderClass}
      transition-all duration-200
      hover:shadow-sm
    `}>
      <div className="flex gap-4">
        {/* Icon */}
        <div className={`
          flex-shrink-0 w-10 h-10 rounded-lg
          flex items-center justify-center
          ${iconClass}
        `}>
          {IconComponent}
        </div>
        
        {/* Content */}
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-[#1A1818] text-base mb-2">
            {title}
          </h3>
          <p className="text-sm text-gray-600 leading-relaxed">
            {content}
          </p>
        </div>
      </div>
    </div>
  );
};

export default StrategyCard;
