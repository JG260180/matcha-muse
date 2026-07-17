import { render, screen, fireEvent } from '@testing-library/react';
import MoreFilters from './MoreFilters';

describe('MoreFilters', () => {
  it('hides its children until opened, then toggles them', () => {
    render(
      <MoreFilters activeCount={0}>
        <p>the filter rows</p>
      </MoreFilters>
    );
    expect(screen.queryByText('the filter rows')).toBeNull();
    const toggle = screen.getByRole('button', { name: 'More filters' });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');

    fireEvent.click(toggle);
    expect(screen.getByText('the filter rows')).toBeDefined();
    expect(toggle.getAttribute('aria-expanded')).toBe('true');

    fireEvent.click(toggle);
    expect(screen.queryByText('the filter rows')).toBeNull();
  });

  it('shows how many hidden filters are on', () => {
    render(<MoreFilters activeCount={2}>x</MoreFilters>);
    expect(screen.getByRole('button', { name: /More filters · 2 on/ })).toBeDefined();
  });
});
