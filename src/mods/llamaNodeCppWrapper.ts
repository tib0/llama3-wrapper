import type { LlamaChatSession, ChatHistoryItem } from 'node-llama-cpp';
import { v4 as uuidv4 } from 'uuid';

export type Gpu = false | 'auto' | 'cuda' | 'vulkan' | 'metal' | undefined;

export type LlamaStatusType = 'uninitialized' | 'ready' | 'loading' | 'generating' | 'error';

export { type ChatHistoryItem } from 'node-llama-cpp';

export interface LlamaStatus {
  status: LlamaStatusType;
  message: string;
}

export interface LlamaCppInfo {
  repo: string;
  release: string;
  vramState: {
    total: number;
    used: number;
    free: number;
  };
}

async function llamaModule(): Promise<typeof import('node-llama-cpp')> {
  return (await import('node-llama-cpp')) as typeof import('node-llama-cpp');
}

export class LlamaWrapper {
  private id: string;
  private session: LlamaChatSession | undefined;
  private status: LlamaStatus;
  private errorCallback: () => void;
  private abortController: AbortController;

  private setStatus(status: LlamaStatusType, payload?: string) {
    if (payload === undefined) {
      switch (status) {
        case 'error':
          payload = 'Provider encountered an error';
          break;
        case 'generating':
          payload = 'Generating';
          break;
        case 'loading':
          payload = 'Model loading';
          break;
        case 'ready':
          payload = `Model ready`;
          break;
        case 'uninitialized':
          payload = 'Provider uninitialized';
      }
    }
    this.status = { status, message: payload };
  }

  public getStatus() {
    return this.status;
  }

  public isReady() {
    return this.status.status === 'ready';
  }

  public getId() {
    return this.id;
  }

  async loadModel(modelPath: string, systemPrompt: string, gpu?: Gpu) {
    if (!modelPath || modelPath === '') {
      console.warn(`Ignoring attempt to load model, no path provided.`);
      return;
    }

    const module = await llamaModule();

    try {
      this.setStatus('loading', `Loading model from ${modelPath}`);

      const llama = await module.getLlama({
        logLevel: module.LlamaLogLevel.warn,
        build: 'never',
        progressLogs: false,
        gpu: gpu || 'auto',
      });

      console.log(`Loading model.`);

      const model = await llama.loadModel({
        modelPath: modelPath,
      });
      console.log(`Model loaded. Context size is ${model.trainContextSize}; Instantiating new session.`);

      const context = await model.createContext();

      this.session = new module.LlamaChatSession({
        contextSequence: context.getSequence(),
        systemPrompt: systemPrompt,
      });
      this.setStatus('ready');
    } catch (err) {
      console.error(err);
      this.setStatus('error', String(err.message));
    }
  }

  public async prompt(message: string, onToken?: (chunk: string) => void): Promise<string> {
    if (this.session === undefined) {
      throw new Error('Cannot prompt model: None loaded');
    }

    this.setStatus('generating');

    let chunks: string = '';
    try {
      const answer = await this.session.prompt(message, {
        onToken: (chunk) => {
          if (onToken !== undefined && this.session !== undefined) {
            const decoded = this.session.model.detokenize(chunk);
            chunks += decoded;
            onToken(decoded);
          }
        },
        signal: this.abortController.signal,
      });
      this.setStatus('ready');
      return answer;
    } catch (err) {
      this.errorCallback();
      this.setStatus('ready');
      return chunks;
    }
  }

  public async getHistory(): Promise<ChatHistoryItem[]> {
    if (this.session === undefined) {
      throw new Error('Cannot prompt model: None loaded');
    }

    this.setStatus('generating');

    try {
      const chatHistory = await this.session.getChatHistory();
      this.setStatus('ready', 'History retrieved');
      return chatHistory;
    } catch (err) {
      this.errorCallback();
      this.setStatus('ready');
      return [];
    }
  }

  public async setHistory(chatHistoryItem: ChatHistoryItem[]): Promise<void> {
    if (this.session === undefined) {
      throw new Error('Cannot prompt model: None loaded');
    }

    this.setStatus('loading', 'Loading chat history');

    try {
      await this.session.setChatHistory(chatHistoryItem);
      this.setStatus('ready', 'Chat history loaded');
      return;
    } catch (err) {
      this.errorCallback();
      this.setStatus('ready', 'Chat history loaded not loaded');
      return;
    }
  }

  constructor() {
    console.log('Instantiating LlamaProvider');
    this.setStatus('uninitialized', 'Provider not initialized');
    this.id = uuidv4();
    this.abortController = new AbortController();
    this.errorCallback = () => {
      this.abortController.abort();
    };
    console.log('With id: ', this.id);
  }
}
