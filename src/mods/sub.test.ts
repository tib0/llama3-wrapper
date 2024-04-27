import { sub } from './sub';

describe('Substraction function', () => {
  test('Returns correct value', () => {
    expect(sub(3, 2)).toEqual(1);
  });
});
