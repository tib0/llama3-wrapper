import * as llamaNodeCpp from './llamaNodeCppWrapper';
import { type ChatHistoryItem } from './llamaNodeCppWrapper';

describe('LlamaNodeCppWrapper', () => {
  let wrapper: llamaNodeCpp.LlamaWrapper;

  beforeAll(() => {
    wrapper = new llamaNodeCpp.LlamaWrapper();
  });
  describe('Exported type...', () => {
    it('ChatHistoryItem', async () => {
      const chatHistoryItem: ChatHistoryItem = {
        type: 'user',
        text: 'Hello',
      };
      expect(chatHistoryItem).toBeTruthy();
    });
  });

  describe('Constructor...', () => {
    it('should be defined', () => {
      expect(wrapper).toBeDefined();
    });
  });

  describe('Defined members...', () => {
    it('getStatus()', () => {
      expect(typeof wrapper.getStatus).toBe('function');
    });

    it('isReady()', () => {
      expect(typeof wrapper.isReady).toBe('function');
    });

    it('getId()', () => {
      expect(typeof wrapper.getId).toBe('function');
    });

    it('getInfos()', () => {
      expect(typeof wrapper.getInfos).toBe('function');
    });

    it('disposeSession()', () => {
      expect(typeof wrapper.disposeSession).toBe('function');
    });

    it('clearHistory()', () => {
      expect(typeof wrapper.clearHistory).toBe('function');
    });

    it('loadModel()', () => {
      expect(typeof wrapper.loadModel).toBe('function');
    });

    it('loadModule()', () => {
      expect(typeof wrapper.loadModule).toBe('function');
    });

    it('loadLlama()', () => {
      expect(typeof wrapper.loadLlama).toBe('function');
    });

    it('loadModel()', () => {
      expect(typeof wrapper.loadModel).toBe('function');
    });

    it('initSession()', () => {
      expect(typeof wrapper.initSession).toBe('function');
    });

    it('prompt()', () => {
      expect(typeof wrapper.prompt).toBe('function');
    });

    it('getHistory()', () => {
      expect(typeof wrapper.getHistory).toBe('function');
    });

    it('setHistory()', () => {
      expect(typeof wrapper.setHistory).toBe('function');
    });
  });

  describe('Should...', () => {
    it('be initialized with a default status', async () => {
      expect(wrapper.getStatus().status).toBe('uninitialized');
    });

    it('throw an error when loading the llama library fails', async () => {
      await expect(wrapper.loadLlama()).rejects.toThrow();
    });

    it('throw an error when loading the model fails', async () => {
      await expect(wrapper.loadModel('path/to/nonexistent/model')).rejects.toThrow();
    });

    it('throw an error when loading the session fails', async () => {
      await expect(wrapper.initSession('You are an assistant.')).rejects.toThrow();
    });

    it('throw an error when prompt fails', async () => {
      await expect(wrapper.prompt('My prompt ?')).rejects.toThrow();
    });
  });
});
