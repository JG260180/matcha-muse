import { render, screen, fireEvent } from '@testing-library/react';
import ConfirmDelete from './ConfirmDelete';

describe('ConfirmDelete', () => {
  it('arms on first tap without deleting', () => {
    const onDelete = vi.fn();
    render(<ConfirmDelete onDelete={onDelete} />);
    fireEvent.click(screen.getByRole('button', { name: 'Delete this matcha' }));
    expect(onDelete).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /Tap again to confirm/ })).toBeDefined();
  });

  it('deletes on the second tap', () => {
    const onDelete = vi.fn();
    render(<ConfirmDelete onDelete={onDelete} />);
    const btn = screen.getByRole('button');
    fireEvent.click(btn);
    fireEvent.click(btn);
    expect(onDelete).toHaveBeenCalledOnce();
  });

  it('disarms when focus leaves the button', () => {
    const onDelete = vi.fn();
    render(<ConfirmDelete onDelete={onDelete} />);
    const btn = screen.getByRole('button');
    fireEvent.click(btn);
    fireEvent.blur(btn);
    expect(screen.getByRole('button', { name: 'Delete this matcha' })).toBeDefined();
  });
});
