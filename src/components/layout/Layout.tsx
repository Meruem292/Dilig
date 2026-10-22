import React, { type ReactNode } from 'react';
import { Header } from './Header';
import { BottomNav, type NavTab } from './BottomNav';
import { Sidebar } from './Sidebar';

export interface LayoutProps {
  currentTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  gatesCount?: number;
  devicesCount?: number;
  onOpenProfile: () => void;
  onOpenThresholds: () => void;
  children: ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({
  currentTab,
  onTabChange,
  gatesCount,
  devicesCount,
  onOpenProfile,
  onOpenThresholds,
  children,
}) => {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Header onOpenProfile={onOpenProfile} onOpenThresholds={onOpenThresholds} />

      <div className="flex-1 flex max-w-6xl w-full mx-auto">
        <Sidebar
          currentTab={currentTab}
          onTabChange={onTabChange}
          gatesCount={gatesCount}
          devicesCount={devicesCount}
        />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 pb-24 sm:pb-8 max-w-4xl w-full mx-auto">
          {children}
        </main>
      </div>

      <BottomNav
        currentTab={currentTab}
        onTabChange={onTabChange}
        gatesCount={gatesCount}
        devicesCount={devicesCount}
      />
    </div>
  );
};
