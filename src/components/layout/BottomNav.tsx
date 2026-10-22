import React from 'react';
import { Home, Sliders, Cpu } from 'lucide-react';

export type NavTab = 'home' | 'gates' | 'devices';

export interface BottomNavProps {
  currentTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  gatesCount?: number;
  devicesCount?: number;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  currentTab,
  onTabChange,
  gatesCount,
  devicesCount,
}) => {
  const tabs = [
    {
      id: 'home' as NavTab,
      label: 'Home',
      icon: Home,
    },
    {
      id: 'gates' as NavTab,
      label: 'Gates',
      icon: Sliders,
      count: gatesCount,
    },
    {
      id: 'devices' as NavTab,
      label: 'Devices',
      icon: Cpu,
      count: devicesCount,
    },
  ];

  return (
    <nav
      className="sm:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-slate-200 z-40 pb-safe shadow-[0_-4px_16px_rgba(0,0,0,0.04)]"
      aria-label="Mobile Navigation"
    >
      <div className="flex items-center justify-around h-16 max-w-md mx-auto px-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = currentTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`flex-1 flex flex-col items-center justify-center py-1.5 transition-all select-none min-h-[48px] relative ${
                isActive
                  ? 'text-nature-700 font-bold'
                  : 'text-slate-500 hover:text-slate-800 font-medium'
              }`}
              aria-current={isActive ? 'page' : undefined}
            >
              <div className="relative">
                <Icon className={`w-5 h-5 transition-transform ${isActive ? 'scale-110 text-nature-600' : ''}`} />
                {typeof tab.count === 'number' && tab.count > 0 && (
                  <span className="absolute -top-1 -right-2.5 min-w-[16px] h-4 px-1 rounded-full bg-slate-100 text-slate-700 text-[10px] font-bold flex items-center justify-center border border-slate-200">
                    {tab.count}
                  </span>
                )}
              </div>
              <span className="text-[11px] mt-1">{tab.label}</span>
              {isActive && (
                <span className="absolute bottom-1 w-8 h-1 rounded-full bg-nature-600" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};
