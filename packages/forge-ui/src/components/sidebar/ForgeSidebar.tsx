import { Link, useLocation } from 'react-router-dom';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarTrigger,
  useSidebar,
} from '@/components/ui/sidebar';
import {
  ForgeIcon,
  RunsIcon,
  ActiveIcon,
  HistoryIcon,
  SettingsIcon,
  SunIcon,
  MoonIcon,
} from '@/components/icons';
import { cn } from '@/lib/utils';
import { useState, useEffect } from 'react';

/**
 * ForgeSidebar - Main sidebar navigation for Forge UI
 *
 * Features:
 * - Header with Forge logo and collapse toggle
 * - Navigation: Runs, Active, History
 * - Theme toggle
 * - Collapsible with localStorage persistence
 */
export function ForgeSidebar() {
  const location = useLocation();
  const { state } = useSidebar();
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');

  // Load theme from localStorage or system preference
  useEffect(() => {
    const saved = localStorage.getItem('forge-theme');
    if (saved === 'light' || saved === 'dark') {
      setTheme(saved);
      document.documentElement.classList.toggle('theme-dark', saved === 'dark');
      document.documentElement.classList.toggle('theme-light', saved === 'light');
    } else {
      // Use system preference
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      setTheme(prefersDark ? 'dark' : 'light');
    }
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    localStorage.setItem('forge-theme', newTheme);
    document.documentElement.classList.toggle('theme-dark', newTheme === 'dark');
    document.documentElement.classList.toggle('theme-light', newTheme === 'light');
  };

  const isActive = (path: string): boolean => {
    if (path === '/forge') {
      return location.pathname === '/forge' || location.pathname === '/forge/';
    }
    return location.pathname.startsWith(path);
  };

  return (
    <Sidebar collapsible="icon">
      <div className="flex flex-col h-full">
        {/* Header: Logo + collapse toggle */}
        <SidebarHeader>
          <div
            className={cn(
              'flex items-center gap-2 px-2 py-2',
              state === 'collapsed' ? 'justify-center' : 'justify-between'
            )}
          >
            <Link
              to="/forge"
              className={cn(
                'flex items-center gap-2 font-semibold text-sidebar-foreground',
                state === 'collapsed' && 'hidden'
              )}
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-accent-orange/10">
                <ForgeIcon size="sm" className="text-accent-orange" />
              </div>
              <span className="text-lg font-display">Forge</span>
            </Link>
            <SidebarTrigger />
          </div>
        </SidebarHeader>

        <SidebarContent>
          {/* Navigation Section */}
          <SidebarGroup>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={isActive('/forge') && !isActive('/forge/runs')}
                  tooltip="Runs"
                >
                  <Link to="/forge">
                    <RunsIcon size="sm" />
                    <span>Runs</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>

              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={location.pathname.includes('/runs/') && location.search.includes('status=running')}
                  tooltip="Active"
                >
                  <Link to="/forge?status=running">
                    <ActiveIcon size="sm" />
                    <span>Active</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>

              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={location.search.includes('status=completed') || location.search.includes('status=failed')}
                  tooltip="History"
                >
                  <Link to="/forge?status=completed">
                    <HistoryIcon size="sm" />
                    <span>History</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroup>
        </SidebarContent>

        {/* Footer: Theme toggle + Settings */}
        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                onClick={toggleTheme}
                tooltip={theme === 'dark' ? 'Light mode' : 'Dark mode'}
              >
                {theme === 'dark' ? <SunIcon size="sm" /> : <MoonIcon size="sm" />}
                <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                isActive={isActive('/forge/settings')}
                tooltip="Settings"
              >
                <Link to="/forge/settings">
                  <SettingsIcon size="sm" />
                  <span>Settings</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </div>
    </Sidebar>
  );
}
