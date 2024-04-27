import { add } from './add';

describe('Sum function', () => {
  test('Returns correct value', () => {
    expect(add(2, 3)).toEqual(5);
  });
});
