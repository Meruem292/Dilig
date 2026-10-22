import React from 'react';

export interface LogoProps {
  /**
   * Mode:
   * - 'responsive': Shows `dilig_logo_1_bigscreen` on larger screens (sm:) and `dilig_logo_smallscreen` on mobile.
   * - 'emblem': Exclusively shows `dilig_logo_smallscreen` (round leaf emblem).
   * - 'full': Exclusively shows `dilig_logo_1_bigscreen` (wide horizontal logo with text).
   */
  mode?: 'responsive' | 'emblem' | 'full';
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  alt?: string;
}

const emblemSizes = {
  xs: 'w-6 h-6',
  sm: 'w-8 h-8',
  md: 'w-10 h-10',
  lg: 'w-14 h-14',
  xl: 'w-20 h-20',
};

const fullSizes = {
  xs: 'h-6 w-auto',
  sm: 'h-8 w-auto',
  md: 'h-10 w-auto',
  lg: 'h-12 w-auto',
  xl: 'h-16 w-auto',
};

export const Logo: React.FC<LogoProps> = ({
  mode = 'responsive',
  size = 'md',
  className = '',
  alt = 'Dilig Smart Irrigation',
}) => {
  if (mode === 'emblem') {
    return (
      <img
        src="/dilig_logo_smallscreen.png"
        alt={alt}
        className={`${emblemSizes[size]} object-contain shrink-0 ${className}`}
      />
    );
  }

  if (mode === 'full') {
    return (
      <img
        src="/dilig_logo_1_bigscreen.png"
        alt={alt}
        className={`${fullSizes[size]} object-contain max-w-full shrink-0 ${className}`}
      />
    );
  }

  // Responsive mode: shows emblem on small screens, wide banner logo on big screens (sm+)
  return (
    <div className={`flex items-center ${className}`}>
      {/* Small screens: Emblem only */}
      <img
        src="/dilig_logo_smallscreen.png"
        alt={alt}
        className={`sm:hidden ${emblemSizes[size]} object-contain shrink-0`}
      />
      {/* Big screens: dilig_logo_1_bigscreen */}
      <img
        src="/dilig_logo_1_bigscreen.png"
        alt={alt}
        className={`hidden sm:block ${fullSizes[size]} object-contain shrink-0`}
      />
    </div>
  );
};
