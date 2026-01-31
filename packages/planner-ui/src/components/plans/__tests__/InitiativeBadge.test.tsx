import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { InitiativeBadge } from '../InitiativeBadge';

describe('InitiativeBadge', () => {
  describe('content rendering', () => {
    it('renders initiative name', () => {
      const initiative = {
        initiative_id: 'init-1',
        name: 'Q1 Launch',
        icon: '🚀',
        color: '#00d9ff',
      };

      render(<InitiativeBadge initiative={initiative} />);

      expect(screen.getByText('Q1 Launch')).toBeInTheDocument();
    });

    it('renders initiative icon', () => {
      const initiative = {
        initiative_id: 'init-1',
        name: 'Q1 Launch',
        icon: '🚀',
        color: '#00d9ff',
      };

      render(<InitiativeBadge initiative={initiative} />);

      const icon = screen.getByText('🚀');
      expect(icon).toBeInTheDocument();
      expect(icon).toHaveAttribute('aria-hidden', 'true');
    });

    it('renders without icon when icon is undefined', () => {
      const initiative = {
        initiative_id: 'init-1',
        name: 'Q1 Launch',
        color: '#00d9ff',
      };

      render(<InitiativeBadge initiative={initiative} />);

      expect(screen.getByText('Q1 Launch')).toBeInTheDocument();
      expect(screen.queryByRole('img')).not.toBeInTheDocument();
    });
  });

  describe('color styling', () => {
    it('applies background color with 0.1 alpha from initiative color', () => {
      const initiative = {
        initiative_id: 'init-1',
        name: 'Q1 Launch',
        color: '#ff6b35',
      };

      const { container } = render(<InitiativeBadge initiative={initiative} />);
      const badge = container.querySelector('span');

      expect(badge).toHaveStyle({
        backgroundColor: 'rgba(255, 107, 53, 0.1)',
      });
    });

    it('applies border color with 0.3 alpha from initiative color', () => {
      const initiative = {
        initiative_id: 'init-1',
        name: 'Q1 Launch',
        color: '#ff6b35',
      };

      const { container } = render(<InitiativeBadge initiative={initiative} />);
      const badge = container.querySelector('span');

      expect(badge).toHaveStyle({
        borderColor: 'rgba(255, 107, 53, 0.3)',
      });
    });

    it('applies text color from initiative color', () => {
      const initiative = {
        initiative_id: 'init-1',
        name: 'Q1 Launch',
        color: '#ff6b35',
      };

      const { container } = render(<InitiativeBadge initiative={initiative} />);
      const badge = container.querySelector('span');

      expect(badge).toHaveStyle({
        color: '#ff6b35',
      });
    });

    it('uses default purple color when color is undefined', () => {
      const initiative = {
        initiative_id: 'init-1',
        name: 'Q1 Launch',
      };

      const { container } = render(<InitiativeBadge initiative={initiative} />);
      const badge = container.querySelector('span');

      // Default color is #9333ea (accent-purple-600)
      expect(badge).toHaveStyle({
        backgroundColor: 'rgba(147, 51, 234, 0.1)',
        borderColor: 'rgba(147, 51, 234, 0.3)',
        color: '#9333ea',
      });
    });

    it('handles hex colors with # prefix', () => {
      const initiative = {
        initiative_id: 'init-1',
        name: 'Q1 Launch',
        color: '#00d9ff',
      };

      const { container } = render(<InitiativeBadge initiative={initiative} />);
      const badge = container.querySelector('span');

      expect(badge).toHaveStyle({
        backgroundColor: 'rgba(0, 217, 255, 0.1)',
      });
    });

    it('handles hex colors without # prefix', () => {
      const initiative = {
        initiative_id: 'init-1',
        name: 'Q1 Launch',
        color: '00d9ff',
      };

      const { container } = render(<InitiativeBadge initiative={initiative} />);
      const badge = container.querySelector('span');

      expect(badge).toHaveStyle({
        backgroundColor: 'rgba(0, 217, 255, 0.1)',
      });
    });
  });

  describe('size variants', () => {
    it('applies small size classes by default', () => {
      const initiative = {
        initiative_id: 'init-1',
        name: 'Q1 Launch',
        color: '#00d9ff',
      };

      const { container } = render(<InitiativeBadge initiative={initiative} />);
      const badge = container.querySelector('span');

      expect(badge).toHaveClass('text-xs', 'px-2', 'py-0.5');
    });

    it('applies small size classes when size="sm"', () => {
      const initiative = {
        initiative_id: 'init-1',
        name: 'Q1 Launch',
        color: '#00d9ff',
      };

      const { container } = render(<InitiativeBadge initiative={initiative} size="sm" />);
      const badge = container.querySelector('span');

      expect(badge).toHaveClass('text-xs', 'px-2', 'py-0.5');
    });

    it('applies medium size classes when size="md"', () => {
      const initiative = {
        initiative_id: 'init-1',
        name: 'Q1 Launch',
        color: '#00d9ff',
      };

      const { container } = render(<InitiativeBadge initiative={initiative} size="md" />);
      const badge = container.querySelector('span');

      expect(badge).toHaveClass('text-sm', 'px-2.5', 'py-1');
    });
  });

  describe('base styling', () => {
    it('applies base badge classes', () => {
      const initiative = {
        initiative_id: 'init-1',
        name: 'Q1 Launch',
        color: '#00d9ff',
      };

      const { container } = render(<InitiativeBadge initiative={initiative} />);
      const badge = container.querySelector('span');

      expect(badge).toHaveClass(
        'inline-flex',
        'items-center',
        'gap-1.5',
        'rounded-full',
        'border',
        'font-medium'
      );
    });

    it('applies custom className', () => {
      const initiative = {
        initiative_id: 'init-1',
        name: 'Q1 Launch',
        color: '#00d9ff',
      };

      const { container } = render(
        <InitiativeBadge initiative={initiative} className="custom-class" />
      );
      const badge = container.querySelector('span');

      expect(badge).toHaveClass('custom-class');
    });
  });
});
