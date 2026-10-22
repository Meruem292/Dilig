import React, { type HTMLAttributes } from 'react';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'white' | 'nature' | 'water' | 'muted';
}

export const Card: React.FC<CardProps> = ({
  children,
  variant = 'white',
  className = '',
  ...props
}) => {
  const variantStyles = {
    white: 'bg-white border-slate-200 text-charcoal shadow-card',
    nature: 'bg-nature-50/70 border-nature-200 text-nature-950 shadow-subtle',
    water: 'bg-water-50/70 border-water-200 text-water-950 shadow-subtle',
    muted: 'bg-slate-50 border-slate-200 text-charcoal shadow-subtle',
  };

  return (
    <div
      className={`rounded-2xl border p-4 sm:p-5 transition-all ${variantStyles[variant]} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};
