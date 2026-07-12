import { initialsFrom } from './profile';

describe('initialsFrom', () => {
  it('takes first letters of the first two words, uppercased', () => {
    expect(initialsFrom('Justina Gardiner')).toBe('JG');
  });
  it('single word gives one letter', () => {
    expect(initialsFrom('Justina')).toBe('J');
  });
  it('ignores extra whitespace and later words', () => {
    expect(initialsFrom('  mary  jane  watson ')).toBe('MJ');
  });
  it('falls back to ? for empty input', () => {
    expect(initialsFrom('   ')).toBe('?');
  });
});
