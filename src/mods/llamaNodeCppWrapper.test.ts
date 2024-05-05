
import * as llamaNodeCpp from './llamaNodeCppWrapper';

jest.mock('./llamaNodeCppWrapper', ()=> {
  return {
    LlamaWrapper : jest.fn().mockImplementation(() => { return {} })
  }
});

describe('Llama Node Cpp Wrapper function', () => {

  test('LlamaWrapper invoke', () => {
    new llamaNodeCpp.LlamaWrapper();
    expect(llamaNodeCpp.LlamaWrapper).toHaveBeenCalledTimes(1);
  });
});