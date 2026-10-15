import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';

interface Props {
  content: string;
  children: React.ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
}

export default function Tooltip({ content, children, position = 'top' }: Props) {
  const [isVisible, setIsVisible] = useState(false);

  const positionClasses = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  };

  const arrowClasses = {
    top: 'top-full left-1/2 -translate-x-1/2 border-t-gray-800',
    bottom: 'bottom-full left-1/2 -translate-x-1/2 border-b-gray-800',
    left: 'left-full top-1/2 -translate-y-1/2 border-l-gray-800',
    right: 'right-full top-1/2 -translate-y-1/2 border-r-gray-800',
  };

  return (
    <div 
      className="relative inline-block"
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
      onFocus={() => setIsVisible(true)}
      onBlur={() => setIsVisible(false)}
    >
      {children}
      <AnimatePresence>
        {isVisible && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: position === 'top' ? 10 : -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: position === 'top' ? 10 : -10 }}
            className={`absolute z-50 px-3.5 py-2 text-xs font-semibold leading-snug text-white bg-stone-900/95 dark:bg-stone-950/95 backdrop-blur-md rounded-xl shadow-2xl border border-white/15 max-w-[260px] sm:max-w-xs whitespace-normal break-words pointer-events-none text-center ${positionClasses[position]}`}
            role="tooltip"
          >
            {content}
            <div className={`absolute border-[6px] border-transparent ${arrowClasses[position]} opacity-90`} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
