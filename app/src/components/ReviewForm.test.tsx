import { render, screen, within, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import ReviewForm, { type ReviewDraft } from './ReviewForm';

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

test('nonsense price keeps save disabled', async () => {
  const onSubmit = vi.fn();
  render(<ReviewForm onSubmit={onSubmit} />);
  const overall = within(screen.getByRole('group', { name: 'Overall' }));
  await userEvent.click(overall.getByRole('button', { name: '4 stars' }));
  await userEvent.type(screen.getByLabelText('Price'), 'Infinity');
  expect(screen.getByRole('button', { name: 'Save matcha' })).toBeDisabled();
});

test('save as draft submits with draft status', async () => {
  const onSubmit = vi.fn();
  render(<ReviewForm onSubmit={onSubmit} />);
  const overall = within(screen.getByRole('group', { name: 'Overall' }));
  await userEvent.click(overall.getByRole('button', { name: '4 stars' }));
  await userEvent.type(screen.getByLabelText('Price'), '7');
  await userEvent.click(screen.getByRole('button', { name: 'Save as draft — finish details later' }));
  expect(onSubmit).toHaveBeenCalledWith(
    expect.objectContaining({ overall: 4, price: '7', status: 'draft' })
  );
});

const filled: ReviewDraft = {
  overall: 4, taste: 3, sweetness: null, texture: null,
  temperature: 'iced', milk: 'oat', drink_style: 'latte', size: 'M',
  price: '6.50', occasions: ['hangout'], note: 'silky', status: 'complete',
};

it('pre-fills fields from initial and uses the given submit label', () => {
  render(<ReviewForm onSubmit={() => {}} initial={filled} submitLabel="Save changes" />);
  expect((screen.getByLabelText('Price') as HTMLInputElement).value).toBe('6.50');
  expect(screen.getByDisplayValue('silky')).toBeDefined();
  expect(screen.getByRole('button', { name: 'Save changes' })).toBeDefined();
});

it('hides the secondary draft button when draftLabel is null', () => {
  render(<ReviewForm onSubmit={() => {}} initial={filled} draftLabel={null} />);
  expect(screen.queryByText(/draft/i)).toBeNull();
});

it('shows Cancel when onCancel is provided and calls it without submitting', () => {
  const onCancel = vi.fn();
  const onSubmit = vi.fn();
  render(<ReviewForm onSubmit={onSubmit} onCancel={onCancel} />);
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(onCancel).toHaveBeenCalledOnce();
  expect(onSubmit).not.toHaveBeenCalled();
});
