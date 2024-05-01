import { LlamaChatSession } from 'node-llama-cpp';
import { getSession } from './llama';

jest.mock('./llama', () => ({
  __esModule: true,
  default: 'mockedDefaultExport',
  getSession: () => 'LlamaChatSession',
}));

describe('Llama function', () => {
  let sessionResult: LlamaChatSession;

  beforeAll(async () => {
    sessionResult = await getSession('You are an assistant, be helpful and concise, you speak in english.');
  });

  test('Session invoke', () => {
    expect(sessionResult).toEqual('LlamaChatSession');
  });
});
