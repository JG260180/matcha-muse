import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import StarRating from './StarRating';

test('tapping the right half of the fourth star selects 4', async () => {
  const onChange = vi.fn();
  render(<StarRating label="Taste" value={null} onChange={onChange} />);
  await userEvent.click(screen.getByRole('button', { name: '4 stars' }));
  expect(onChange).toHaveBeenCalledWith(4);
});

test('tapping the left half of a star selects the half step', async () => {
  const onChange = vi.fn();
  render(<StarRating label="Taste" value={null} onChange={onChange} />);
  await userEvent.click(screen.getByRole('button', { name: '3.5 stars' }));
  expect(onChange).toHaveBeenCalledWith(3.5);
});
