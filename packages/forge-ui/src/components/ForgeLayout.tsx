import { Outlet } from 'react-router-dom';
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { ForgeSidebar } from '@/components/sidebar/ForgeSidebar';
import { ForgeRunProvider } from '@/context/ForgeRunContext';
import { ForgeStatusBar } from '@/components/ForgeStatusBar';

/**
 * ForgeLayout - Main application layout component
 *
 * Structure:
 * - SidebarProvider: Manages sidebar state (collapsed/expanded, mobile drawer)
 * - ForgeSidebar: Left sidebar with navigation
 * - SidebarInset: Main content area with router outlet
 * - ForgeRunProvider: Context for active run state
 * - ForgeStatusBar: Global status bar at bottom showing active run info
 */
export function ForgeLayout() {
  return (
    <SidebarProvider>
      <ForgeSidebar />
      <SidebarInset>
        {/* Mobile header with hamburger menu */}
        <header className="flex h-12 items-center gap-2 border-b px-4 md:hidden">
          <SidebarTrigger />
          <span className="font-display font-medium">Forge</span>
        </header>

        <ForgeRunProvider>
          {/* Main content with bottom padding for status bar */}
          <main className="flex h-full w-full flex-1 flex-col overflow-auto pb-12">
            <Outlet />
          </main>

          {/* Global status bar */}
          <ForgeStatusBar />
        </ForgeRunProvider>
      </SidebarInset>
    </SidebarProvider>
  );
}
