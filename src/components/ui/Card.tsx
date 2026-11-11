import React from 'react';

interface Props extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

/** The plain surface the simple screens are built from. */
export default function Card({ children, className = '', ...rest }: Props) {
  return (
    <div
      {...rest}
      className={`rounded-3xl bg-white dark:bg-[#0c1c13] border border-stone-200 dark:border-emerald-900/50 p-4 shadow-sm ${className}`}
    >
      {children}
    </div>
  );
}
