import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { App } from './App';

describe('App', () => {
  it('renders the navigation with brand and links', () => {
    render(<App />);

    // Brand in nav
    expect(screen.getByRole('link', { name: 'Planner' })).toBeInTheDocument();

    // Nav links
    const navLinks = screen.getByRole('navigation');
    expect(navLinks).toBeInTheDocument();

    // New Plan link
    expect(screen.getByRole('link', { name: 'New Plan' })).toBeInTheDocument();
  });

  it('shows loading state on initial render', () => {
    render(<App />);

    // The plans list page shows loading initially
    expect(screen.getByText('Loading plans...')).toBeInTheDocument();
  });
});
