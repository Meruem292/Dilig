import React from 'react';
import { Home, Sliders, Cpu } from 'lucide-react';
import type { NavTab } from './BottomNav';

export interface SidebarProps {
  currentTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  gatesCount?: number;
  devicesCount?: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onTabChange,
  gatesCount,
  devicesCount,
}) => {
  const tabs = [
    {
      id: 'home' as NavTab,
      label: 'Home Dashboard',
      icon: Home,
    },
    {
      id: 'gates' as NavTab,
      label: 'Irrigation Gates',
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
    <aside className="hidden sm:block w-60 border-r border-slate-200 bg-white min-h-[calc(100vh-64px)] p-4">
      <nav className="space-y-1.5" aria-label="Desktop Navigation">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = currentTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl text-sm font-semibold transition-all ${
                isActive
                  ? 'bg-nature-50 text-nature-800 border border-nature-200 shadow-subtle'
                  : 'text-slate-600 hover:text-charcoal hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon className={`w-5 h-5 ${isActive ? 'text-nature-600' : 'text-slate-400'}`} />
                <span>{tab.label}</span>
              </div>
              {typeof tab.count === 'number' && tab.count > 0 && (
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                    isActive ? 'bg-nature-200 text-nature-900' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </nav>
    </aside>
  );
};
