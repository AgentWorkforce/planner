import { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarTrigger,
  useSidebar,
} from '@/components/ui/sidebar';
import {
  PlansIcon,
  PipelineIcon,
  SettingsIcon,
  PlusIcon,
  SearchIcon,
  InitiativesIcon,
  SunIcon,
  MoonIcon,
  ChannelIcon,
} from '@/components/icons';
import { useInitiatives } from '@/hooks/useInitiatives';
import { useActiveChannels } from '@/hooks/useActiveChannels';
import { useCommandPalette } from '@/hooks/useCommandPalette';
import { useSidebarState } from '@/hooks/useSidebarState';
import { useTheme } from '@/hooks/useTheme';
import { cn } from '@/lib/utils';
import { InitiativeModal } from '@/components/initiatives/InitiativeModal';
import { InitiativeCollapsible } from './InitiativeCollapsible';
import { createInitiative } from '@/api/initiatives';
import type { CreateInitiativeInput, UpdateInitiativeInput } from '@/types/initiative';

/**
 * AppSidebar - Main application sidebar component
 *
 * Features:
 * - Header with logo and collapse toggle
 * - Navigation section (Initiatives, All Plans, Pipeline)
 * - Initiatives section with list
 * - Footer with Settings link
 * - Responsive: collapses to icon-only on desktop, slide-out drawer on mobile
 * - Active route highlighting
 * - Tooltips in collapsed state
 *
 * Keyboard navigation:
 * - Cmd/Ctrl+B: Toggle sidebar (built into SidebarProvider)
 * - Tab: Navigate through menu items
 * - Enter/Space: Activate focused link
 * - ArrowUp/ArrowDown: Navigate within menu groups
 * - Escape: Close mobile drawer
 * - Auto-focus first item when mobile drawer opens
 *
 * Focus indicators:
 * - Uses --sidebar-ring CSS variable (accent-cyan)
 * - Built into SidebarMenuButton components via ring-sidebar-ring class
 *
 * Uses shadcn/ui sidebar primitives for consistent behavior.
 */
export function AppSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { state, isMobile, openMobile, setOpenMobile } = useSidebar();
  const { initiatives, isLoading, refresh } = useInitiatives();
  const { activeChannels, isLoading: channelsLoading } = useActiveChannels();
  const { open: openCommandPalette } = useCommandPalette();
  const { isInitiativeExpanded, toggleInitiativeExpanded } = useSidebarState();
  const { effectiveTheme, toggleTheme } = useTheme();
  const [modalOpen, setModalOpen] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);

  // Check if a path is active
  const isActive = (path: string): boolean => {
    if (path === '/') {
      return location.pathname === '/';
    }
    return location.pathname.startsWith(path);
  };

  // Handle creating new initiative
  const handleCreateInitiative = async (data: CreateInitiativeInput | UpdateInitiativeInput) => {
    // Only create is supported from sidebar (no edit mode)
    await createInitiative(data as CreateInitiativeInput);
    await refresh();
    setModalOpen(false);
  };

  // Keyboard navigation: Escape closes mobile drawer
  useEffect(() => {
    if (!isMobile || !openMobile) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setOpenMobile(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isMobile, openMobile, setOpenMobile]);

  // Keyboard navigation: Arrow keys navigate within menus
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle arrow keys when focus is within sidebar
      if (!sidebarRef.current?.contains(document.activeElement)) {
        return;
      }

      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();

        // Get all focusable menu items
        const menuItems = sidebarRef.current.querySelectorAll<HTMLElement>(
          '[data-sidebar="menu-button"]:not([disabled])'
        );

        if (menuItems.length === 0) return;

        const currentIndex = Array.from(menuItems).findIndex(
          (item) => item === document.activeElement || item.contains(document.activeElement)
        );

        let nextIndex: number;
        if (e.key === 'ArrowDown') {
          nextIndex = currentIndex < menuItems.length - 1 ? currentIndex + 1 : 0;
        } else {
          nextIndex = currentIndex > 0 ? currentIndex - 1 : menuItems.length - 1;
        }

        menuItems[nextIndex]?.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Focus management: Focus first item when mobile sidebar opens
  useEffect(() => {
    if (isMobile && openMobile && sidebarRef.current) {
      // Small delay to allow sheet animation to complete
      const timer = setTimeout(() => {
        const firstMenuItem = sidebarRef.current?.querySelector<HTMLElement>(
          '[data-sidebar="menu-button"]'
        );
        firstMenuItem?.focus();
      }, 100);

      return () => clearTimeout(timer);
    }
  }, [isMobile, openMobile]);

  return (
    <Sidebar collapsible="icon">
      <div ref={sidebarRef} className="flex flex-col h-full">
        {/* Header: Logo + collapse toggle */}
        <SidebarHeader>
          <div className={cn(
            'flex items-center gap-2 px-2 py-2',
            state === 'collapsed' ? 'justify-center' : 'justify-between'
          )}>
            <Link
              to="/"
              className={cn(
                'flex items-center gap-2 font-semibold text-sidebar-foreground',
                state === 'collapsed' && 'hidden'
              )}
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-accent-cyan/10">
                <div className="h-4 w-4 rotate-45 border-2 border-accent-cyan" />
              </div>
              <span className="text-lg">Planner</span>
            </Link>
            <SidebarTrigger />
          </div>
        </SidebarHeader>

        <SidebarContent>
        {/* Quick Actions */}
        <SidebarGroup>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                onClick={() => navigate('/plans/new')}
                tooltip="New Plan"
              >
                <PlusIcon size="sm" />
                <span>New Plan</span>
              </SidebarMenuButton>
            </SidebarMenuItem>

            <SidebarMenuItem>
              <SidebarMenuButton
                onClick={openCommandPalette}
                tooltip="Search"
              >
                <SearchIcon size="sm" />
                <span>Search</span>
                <kbd className="ml-auto hidden h-5 rounded border border-sidebar-border bg-sidebar-accent px-1.5 text-xs font-medium text-sidebar-foreground group-data-[collapsible=icon]:hidden md:inline-flex">
                  ⌘K
                </kbd>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>

        {/* Navigation Section */}
        <SidebarGroup>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                isActive={isActive('/initiatives')}
                tooltip="Initiatives"
              >
                <Link to="/initiatives">
                  <InitiativesIcon size="sm" />
                  <span>Initiatives</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>

            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                isActive={isActive('/plans')}
                tooltip="All Plans"
              >
                <Link to="/plans">
                  <PlansIcon size="sm" />
                  <span>All Plans</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>

            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                isActive={isActive('/pipeline')}
                tooltip="Pipeline"
              >
                <Link to="/pipeline">
                  <PipelineIcon size="sm" />
                  <span>Pipeline</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>

        {/* Active Channels Section */}
        <SidebarGroup>
          <SidebarGroupLabel>ACTIVE CHANNELS</SidebarGroupLabel>
          <SidebarMenu>
            {channelsLoading ? (
              <SidebarMenuItem>
                <div className="flex items-center gap-2 px-2 py-2">
                  <div className="h-4 w-4 animate-pulse rounded bg-sidebar-accent" />
                  <div className="h-4 flex-1 animate-pulse rounded bg-sidebar-accent" />
                </div>
              </SidebarMenuItem>
            ) : activeChannels.length === 0 ? (
              <SidebarMenuItem>
                <div className="px-2 py-2 text-xs text-sidebar-foreground/50 group-data-[collapsible=icon]:hidden">
                  No active channels
                </div>
              </SidebarMenuItem>
            ) : (
              activeChannels.map((channel) => (
                <SidebarMenuItem key={channel.id}>
                  <SidebarMenuButton
                    asChild
                    isActive={location.pathname === `/channels/${encodeURIComponent(channel.id)}`}
                    tooltip={channel.displayName || channel.name}
                  >
                    <Link to={`/channels/${encodeURIComponent(channel.id)}`}>
                      <ChannelIcon size="sm" />
                      <span>{channel.displayName || channel.name}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))
            )}
          </SidebarMenu>
        </SidebarGroup>

        {/* Initiatives Section */}
        <SidebarGroup>
          <div className="relative">
            <SidebarGroupLabel>INITIATIVES</SidebarGroupLabel>
            <button
              onClick={() => setModalOpen(true)}
              className="absolute right-3 top-2 flex h-5 w-5 items-center justify-center rounded-md text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground group-data-[collapsible=icon]:hidden"
              title="New Initiative"
            >
              <PlusIcon size="sm" />
            </button>
          </div>

          <SidebarMenu>
            {isLoading ? (
              // Loading skeleton
              <SidebarMenuItem>
                <div className="flex items-center gap-2 px-2 py-2">
                  <div className="h-4 w-4 animate-pulse rounded-full bg-sidebar-accent" />
                  <div className="h-4 flex-1 animate-pulse rounded bg-sidebar-accent" />
                </div>
              </SidebarMenuItem>
            ) : initiatives.length === 0 ? (
              // Empty state
              <SidebarMenuItem>
                <div className="px-2 py-2 text-xs text-sidebar-foreground/50 group-data-[collapsible=icon]:hidden">
                  No initiatives yet
                </div>
              </SidebarMenuItem>
            ) : (
              // Initiative list with collapsible nested plans
              initiatives.map((initiative) => (
                <InitiativeCollapsible
                  key={initiative.initiative_id}
                  initiative={{
                    initiative_id: initiative.initiative_id,
                    name: initiative.name,
                    icon: initiative.icon,
                    color: initiative.color,
                  }}
                  plans={
                    'plans' in initiative && Array.isArray(initiative.plans)
                      ? initiative.plans.map((plan) => ({
                          plan_id: plan.plan_id,
                          goal: plan.goal,
                          status: plan.status,
                        }))
                      : []
                  }
                  isExpanded={isInitiativeExpanded(initiative.initiative_id)}
                  onToggleExpanded={() => toggleInitiativeExpanded(initiative.initiative_id)}
                />
              ))
            )}
          </SidebarMenu>
        </SidebarGroup>
        </SidebarContent>

        {/* Footer: Theme toggle + Settings */}
        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                onClick={toggleTheme}
                tooltip={effectiveTheme === 'dark' ? 'Light mode' : 'Dark mode'}
              >
                {effectiveTheme === 'dark' ? <SunIcon size="sm" /> : <MoonIcon size="sm" />}
                <span>{effectiveTheme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                isActive={isActive('/settings')}
                tooltip="Settings"
              >
                <Link to="/settings">
                  <SettingsIcon size="sm" />
                  <span>Settings</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </div>

      {/* Initiative Modal */}
      <InitiativeModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        onSave={handleCreateInitiative}
      />
    </Sidebar>
  );
}
