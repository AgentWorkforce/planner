import { ComponentType } from 'react';
import {
  BuildingIcon,
  GridIcon,
  PaletteIcon,
  FlaskIcon,
  ShieldIcon,
  BrainIcon,
  UsersIcon,
  SettingsIcon,
  BoltIcon,
  TargetIcon,
} from '@/components/icons';

interface IconProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

// Mapping from role hints to icons
const ROLE_HINT_ICONS: Record<string, ComponentType<IconProps>> = {
  architecture: BuildingIcon,
  data: GridIcon,
  design: PaletteIcon,
  test: FlaskIcon,
  security: ShieldIcon,
  user: UsersIcon,
  ux: UsersIcon,
  devops: SettingsIcon,
  performance: BoltIcon,
  product: TargetIcon,
};

// Name patterns to icons (case-insensitive)
const NAME_PATTERNS: [RegExp, ComponentType<IconProps>][] = [
  [/architect/i, BuildingIcon],
  [/design/i, PaletteIcon],
  [/data/i, GridIcon],
  [/test/i, FlaskIcon],
  [/qa/i, FlaskIcon],
  [/security/i, ShieldIcon],
  [/user|ux/i, UsersIcon],
  [/devops|infra|ops/i, SettingsIcon],
  [/performance|speed/i, BoltIcon],
  [/product|pm/i, TargetIcon],
];

export function getSpecialistIcon(
  name: string,
  roleHint?: string
): ComponentType<IconProps> {
  // First, check role hint
  if (roleHint) {
    const hintLower = roleHint.toLowerCase();
    if (ROLE_HINT_ICONS[hintLower]) {
      return ROLE_HINT_ICONS[hintLower];
    }
  }

  // Next, check name patterns
  for (const [pattern, Icon] of NAME_PATTERNS) {
    if (pattern.test(name)) {
      return Icon;
    }
  }

  // Fallback to brain icon
  return BrainIcon;
}
