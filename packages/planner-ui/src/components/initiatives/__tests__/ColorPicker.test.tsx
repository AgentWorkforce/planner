import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ColorPicker } from '../ColorPicker';

const PRESET_COLORS = [
  { hex: '#00d9ff', name: 'Cyan' },
  { hex: '#a855f7', name: 'Purple' },
  { hex: '#00ffc8', name: 'Green' },
  { hex: '#ff6b35', name: 'Orange' },
  { hex: '#f472b6', name: 'Pink' },
  { hex: '#facc15', name: 'Yellow' },
];

describe('ColorPicker', () => {
  it('renders all 6 color swatches', () => {
    render(<ColorPicker value="#00d9ff" onChange={vi.fn()} />);

    const radioGroup = screen.getByRole('radiogroup', { name: 'Color picker' });
    expect(radioGroup).toBeInTheDocument();

    PRESET_COLORS.forEach((color) => {
      const swatch = screen.getByRole('radio', { name: `${color.name} color` });
      expect(swatch).toBeInTheDocument();
    });
  });

  it('highlights the selected color with ring styles', () => {
    render(<ColorPicker value="#a855f7" onChange={vi.fn()} />);

    const selectedSwatch = screen.getByRole('radio', { name: 'Purple color' });
    const unselectedSwatch = screen.getByRole('radio', { name: 'Cyan color' });

    expect(selectedSwatch).toHaveAttribute('aria-checked', 'true');
    expect(selectedSwatch).toHaveAttribute('tabIndex', '0');
    expect(unselectedSwatch).toHaveAttribute('aria-checked', 'false');
    expect(unselectedSwatch).toHaveAttribute('tabIndex', '-1');
  });

  it('highlights selected color case-insensitively', () => {
    render(<ColorPicker value="#A855F7" onChange={vi.fn()} />);

    const selectedSwatch = screen.getByRole('radio', { name: 'Purple color' });
    expect(selectedSwatch).toHaveAttribute('aria-checked', 'true');
  });

  it('calls onChange when color is clicked', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ColorPicker value="#00d9ff" onChange={onChange} />);

    const greenSwatch = screen.getByRole('radio', { name: 'Green color' });
    await user.click(greenSwatch);

    expect(onChange).toHaveBeenCalledWith('#00ffc8');
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  describe('keyboard navigation', () => {
    it('navigates right with ArrowRight key', async () => {
      const user = userEvent.setup();
      render(<ColorPicker value="#00d9ff" onChange={vi.fn()} />);

      const cyanSwatch = screen.getByRole('radio', { name: 'Cyan color' });
      cyanSwatch.focus();
      await user.keyboard('{ArrowRight}');

      const purpleSwatch = screen.getByRole('radio', { name: 'Purple color' });
      expect(purpleSwatch).toHaveFocus();
    });

    it('navigates left with ArrowLeft key', async () => {
      const user = userEvent.setup();
      render(<ColorPicker value="#a855f7" onChange={vi.fn()} />);

      const purpleSwatch = screen.getByRole('radio', { name: 'Purple color' });
      purpleSwatch.focus();
      await user.keyboard('{ArrowLeft}');

      const cyanSwatch = screen.getByRole('radio', { name: 'Cyan color' });
      expect(cyanSwatch).toHaveFocus();
    });

    it('wraps from last to first when navigating right', async () => {
      const user = userEvent.setup();
      render(<ColorPicker value="#facc15" onChange={vi.fn()} />);

      const yellowSwatch = screen.getByRole('radio', { name: 'Yellow color' });
      yellowSwatch.focus();
      await user.keyboard('{ArrowRight}');

      const cyanSwatch = screen.getByRole('radio', { name: 'Cyan color' });
      expect(cyanSwatch).toHaveFocus();
    });

    it('wraps from first to last when navigating left', async () => {
      const user = userEvent.setup();
      render(<ColorPicker value="#00d9ff" onChange={vi.fn()} />);

      const cyanSwatch = screen.getByRole('radio', { name: 'Cyan color' });
      cyanSwatch.focus();
      await user.keyboard('{ArrowLeft}');

      const yellowSwatch = screen.getByRole('radio', { name: 'Yellow color' });
      expect(yellowSwatch).toHaveFocus();
    });

    it('navigates to first color with Home key', async () => {
      const user = userEvent.setup();
      render(<ColorPicker value="#ff6b35" onChange={vi.fn()} />);

      const orangeSwatch = screen.getByRole('radio', { name: 'Orange color' });
      orangeSwatch.focus();
      await user.keyboard('{Home}');

      const cyanSwatch = screen.getByRole('radio', { name: 'Cyan color' });
      expect(cyanSwatch).toHaveFocus();
    });

    it('navigates to last color with End key', async () => {
      const user = userEvent.setup();
      render(<ColorPicker value="#00d9ff" onChange={vi.fn()} />);

      const cyanSwatch = screen.getByRole('radio', { name: 'Cyan color' });
      cyanSwatch.focus();
      await user.keyboard('{End}');

      const yellowSwatch = screen.getByRole('radio', { name: 'Yellow color' });
      expect(yellowSwatch).toHaveFocus();
    });

    it('selects color with Enter key', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(<ColorPicker value="#00d9ff" onChange={onChange} />);

      const cyanSwatch = screen.getByRole('radio', { name: 'Cyan color' });
      cyanSwatch.focus();
      await user.keyboard('{ArrowRight}'); // Move to Purple
      await user.keyboard('{Enter}');

      expect(onChange).toHaveBeenCalledWith('#a855f7');
    });

    it('selects color with Space key', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(<ColorPicker value="#00d9ff" onChange={onChange} />);

      const cyanSwatch = screen.getByRole('radio', { name: 'Cyan color' });
      cyanSwatch.focus();
      await user.keyboard('{ArrowRight}'); // Move to Purple
      await user.keyboard(' ');

      expect(onChange).toHaveBeenCalledWith('#a855f7');
    });
  });

  it('applies custom className', () => {
    const { container } = render(
      <ColorPicker value="#00d9ff" onChange={vi.fn()} className="custom-class" />
    );

    const radioGroup = container.querySelector('.custom-class');
    expect(radioGroup).toBeInTheDocument();
  });

  it('sets correct background color for each swatch', () => {
    render(<ColorPicker value="#00d9ff" onChange={vi.fn()} />);

    PRESET_COLORS.forEach((color) => {
      const swatch = screen.getByRole('radio', { name: `${color.name} color` });
      expect(swatch).toHaveStyle({ backgroundColor: color.hex });
    });
  });
});
