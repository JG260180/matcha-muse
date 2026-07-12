import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import BackToJournal from './BackToJournal';

it('links back to the journal home', () => {
  render(<MemoryRouter><BackToJournal /></MemoryRouter>);
  const link = screen.getByRole('link', { name: /journal/i });
  expect(link.getAttribute('href')).toBe('/');
});
