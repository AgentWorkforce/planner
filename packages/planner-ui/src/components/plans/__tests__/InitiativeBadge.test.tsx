import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { InitiativeBadge } from '../InitiativeBadge';

describe('InitiativeBadge', () => {
  describe('content rendering', () => {
    it('renders initiative name', () => {
      const initiative = {
        initiative_id: 'init-1',
        name: 'Q1 Launch',
        color: '#00d9ff',
      };

      render(<InitiativeBadge initiative={initiative} />);

      expect(screen.getByText('Q1 Launch')).toBeInTheDocument();
    });

    it('renders without error when color is undefined', () => {
      const initiative = {
        initiative_id: 'init-1',
        name: 'Q1 Launch',
      };

      render(<InitiativeBadge initiative={initiative} />);

      expect(screen.getByText('Q1 Launch')).toBeInTheDocument();
    });
  });

  describe('color dot', () => {
    it('renders colored dot with initiative color', () => {
      const initiative = {
        initiative_id: 'init-1',
        name: 'Q1 Launch',
        color: '#ff6b35',
      };

      const { container } = render(<InitiativeBadge initiative={initiative} />);
      const dot = container.querySelector('.rounded-full[aria-hidden="true"]');

      expect(dot).toBeInTheDocument();
      expect(dot).toHaveStyle({ backgroundColor: '#ff6b35' });
    });

    it('uses default cyan color when color is undefined', () => {
      const initiative = {
        initiative_id: 'init-1',
        name: 'Q1 Launch',
      };

      const { container } = render(<InitiativeBadge initiative={initiative} />);
      const dot = container.querySelector('.rounded-full[aria-hidden="true"]');

      expect(dot).toBeInTheDocument();
      // Default color is #00d9ff (accent-cyan)
      expect(dot).toHaveStyle({ backgroundColor: '#00d9ff' });
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

      expect(badge).toHaveClass('text-xs', 'px-1.5', 'py-0.5');
    });

    it('applies small size classes when size="sm"', () => {
      const initiative = {
        initiative_id: 'init-1',
        name: 'Q1 Launch',
        color: '#00d9ff',
      };

      const { container } = render(<InitiativeBadge initiative={initiative} size="sm" />);
      const badge = container.querySelector('span');

      expect(badge).toHaveClass('text-xs', 'px-1.5', 'py-0.5');
    });

    it('applies medium size classes when size="md"', () => {
      const initiative = {
        initiative_id: 'init-1',
        name: 'Q1 Launch',
        color: '#00d9ff',
      };

      const { container } = render(<InitiativeBadge initiative={initiative} size="md" />);
      const badge = container.querySelector('span');

      expect(badge).toHaveClass('text-sm', 'px-2', 'py-1');
    });

    it('applies small dot size by default', () => {
      const initiative = {
        initiative_id: 'init-1',
        name: 'Q1 Launch',
        color: '#00d9ff',
      };

      const { container } = render(<InitiativeBadge initiative={initiative} />);
      const dot = container.querySelector('.rounded-full[aria-hidden="true"]');

      expect(dot).toHaveClass('w-2', 'h-2');
    });

    it('applies medium dot size when size="md"', () => {
      const initiative = {
        initiative_id: 'init-1',
        name: 'Q1 Launch',
        color: '#00d9ff',
      };

      const { container } = render(<InitiativeBadge initiative={initiative} size="md" />);
      const dot = container.querySelector('.rounded-full[aria-hidden="true"]');

      expect(dot).toHaveClass('w-2.5', 'h-2.5');
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
        'rounded',
        'bg-bg-tertiary',
        'text-text-secondary'
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

  describe('accessibility', () => {
    it('marks color dot as aria-hidden', () => {
      const initiative = {
        initiative_id: 'init-1',
        name: 'Q1 Launch',
        color: '#00d9ff',
      };

      const { container } = render(<InitiativeBadge initiative={initiative} />);
      const dot = container.querySelector('.rounded-full');

      expect(dot).toHaveAttribute('aria-hidden', 'true');
    });
  });
});
