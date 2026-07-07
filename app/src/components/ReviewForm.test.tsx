import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import ReviewForm from './ReviewForm';

test('save is disabled until overall and price are set, then submits', async () => {
  const onSubmit = vi.fn();
  render(<ReviewForm onSubmit={onSubmit} />);
  const save = screen.getByRole('button', { name: 'Save matcha' });
  expect(save).toBeDisabled();

  const overall = within(screen.getByRole('group', { name: 'Overall' }));
  await userEvent.click(overall.getByRole('button', { name: '4.5 stars' }));
  expect(save).toBeDisabled();

  await userEvent.type(screen.getByLabelText('Price'), '6.50');
  expect(save).toBeEnabled();

  await userEvent.click(screen.getByLabelText('Grab & go'));
  await userEvent.click(save);
  expect(onSubmit).toHaveBeenCalledWith(
    expect.objectContaining({
      overall: 4.5,
      price: '6.50',
      occasions: ['grab_go'],
      status: 'complete',
    })
  );
});
