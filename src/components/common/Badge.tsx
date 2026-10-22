import React, { type HTMLAttributes } from 'react';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: 'green' | 'blue' | 'gray' | 'amber' | 'red';
  size?: 'sm' | 'md';
  dot?: boolean;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'gray',
  size = 'md',
  dot = false,
  className = '',
  ...props
}) => {
  const sizeStyles = {
    sm: 'text-xs px-2 py-0.5 gap-1 font-medium',
    md: 'text-xs sm:text-sm px-2.5 py-1 gap-1.5 font-medium',
  };

  const variantStyles = {
    green: 'bg-nature-100 text-nature-800 border-nature-200',
    blue: 'bg-water-100 text-water-800 border-water-200',
    gray: 'bg-slate-100 text-slate-700 border-slate-200',
    amber: 'bg-amber-100 text-amber-850 border-amber-200',
    red: 'bg-red-100 text-red-800 border-red-200',
  };

  const dotColors = {
    green: 'bg-nature-600',
    blue: 'bg-water-600',
    gray: 'bg-slate-500',
    amber: 'bg-amber-500',
    red: 'bg-red-500',
  };

  return (
    <span
      className={`inline-flex items-center rounded-full border ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}
      {...props}
    >
      {dot && <span className={`w-1.5 h-1.5 rounded-full ${dotColors[variant]} flex-shrink-0`} />}
      <span>{children}</span>
    </span>
  );
};
