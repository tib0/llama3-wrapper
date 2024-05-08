import type { LlamaChatSession, ChatHistoryItem, LlamaModel, Llama } from 'node-llama-cpp';
import { v4 as uuidv4 } from 'uuid';

export type Gpu = false | 'auto' | 'cuda' | 'vulkan' | 'metal' | undefined;

export type LlamaStatusType = 'uninitialized' | 'ready' | 'loading' | 'generating' | 'error';

export { type ChatHistoryItem } from 'node-llama-cpp';

export interface LlamaStatus {
  status: LlamaStatusType;
  message: string;
}

export interface LlamaCppInfo {
  id?: string;
  model?: {
    filename: string;
    trainContextSize: number;
  };
  context?: {
    batchSize: number;
    contextSize: number;
    sequencesLeft: number;
    stateSize: number;
    totalSequences: number;
  };
  llama?: {
    vramState?: {
      total: number;
      used: number;
      free: number;
    };
    devicesNames?: string[];
  };
}

async function llamaModule(): Promise<typeof import('node-llama-cpp')> {
  return (await import('node-llama-cpp')) as typeof import('node-llama-cpp');
}

export class LlamaWrapper {
  private id: string;
  private session: LlamaChatSession | undefined;
  private status: LlamaStatus;
  private model: LlamaModel | undefined;
  private errorCallback: () => void;
  private abortController: AbortController;
  private module: typeof import("node-llama-cpp");
  private llama: Llama;
  private setStatus(status: LlamaStatusType, payload?: string) {
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

  public getInfos(): LlamaCppInfo {
    let infos = {};

    if (this.id) {
      infos = {
        ...infos,
        id: this.id,
      }
    }
    if (this.model) {
      infos = {
        ...infos,
        model: {
          filename: this.model.filename,
          trainContextSize: this.model.trainContextSize,
        },
      }
    }

    if (this.session.context) {
      infos = {
        ...infos,
        context: {
          batchSize: this.session.context.batchSize,
          contextSize: this.session.context.contextSize,
          sequencesLeft: this.session.context.sequencesLeft,
          stateSize: this.session.context.stateSize,
          totalSequences: this.session.context.totalSequences,
        },
      }
    }
    if (this.llama) {
      infos = {
        ...infos,
        llama: { 
          vramState: this.llama.getVramState(),
          devicesNames: this.llama.getGpuDeviceNames(),
        },
      }
    }
    return infos;
  }

  public disposeSession() {
    this.session.dispose();
  }

  public clearHistory() {
    this.session.sequence.clearHistory();
  }

  async loadModule() {
    try {
      this.setStatus('loading', `Loading module from Node Llama Cpp`);
      this.module = await llamaModule();
      console.debug(`Module loaded.`);
      this.setStatus('ready');
    } catch (err) {
      console.error(err);
      this.setStatus('error', String(err.message));
    }
  }

  async loadLlama(gpu?: Gpu) {
    if (!this.module) {
      throw new Error(`Ignoring attempt to load model, no module found.`);
    }

    try {
      this.setStatus('loading', `Loading Llama lib`);

      console.debug(`Loading llama.`);
      this.llama = await this.module.getLlama({
        logLevel: this.module.LlamaLogLevel.warn,
        build: 'never',
        progressLogs: false,
        gpu: gpu || 'auto',
      });

      console.debug(`Llama loaded.`);

      this.setStatus('ready');
    } catch (err) {
      console.error(err);
      this.setStatus('error', String(err.message));
    }
  }

  async loadModel(modelPath: string) {
    if (!modelPath || modelPath === '') {
      throw new Error(`Ignoring attempt to load model, no path provided.`);
    }
    if (!this.module) {
      throw new Error(`Ignoring attempt to load model, no module found.`);
    }
    if (!this.llama) {
      throw new Error(`Ignoring attempt to load model, no llama lib loaded.`);
    }

    try {
      this.setStatus('loading', `Loading model from ${modelPath}`);

      
      console.debug(`Loading model.`);

      this.model = await this.llama.loadModel({
        modelPath: modelPath,
      });
      
      console.debug(`Model loaded. Context size is ${this.model.trainContextSize}; Instantiating new session.`);

      this.setStatus('ready');
    } catch (err) {
      console.error(err);
      this.setStatus('error', String(err.message));
    }
  }

  async initSession(systemPrompt: string) {
    if (!this.model) {
      throw new Error(`Ignoring attempt to init session, no model loaded.`);
    }
    if (!this.module) {
      throw new Error(`Ignoring attempt to load model, no module found.`);
    }

    try {
      this.setStatus('loading', `Initializing session`);
      
      const context = await this.model.createContext({ threads: 0, seed: 42, sequences: 2 });
      
      this.session = new this.module.LlamaChatSession({
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
      throw new Error('Ignoring prompt, no session found');
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
      throw new Error('Ignoring get history, no session found');
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
      throw new Error('Ignoring set history, no session found');
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
    console.debug('Instantiating LlamaWrapper');
    this.setStatus('uninitialized', 'Wrapper not initialized');
    this.id = uuidv4();
    this.abortController = new AbortController();
    this.errorCallback = () => {
      this.abortController.abort();
      if (this.session) this.session.dispose();
    };
    console.debug('With id: ', this.id);
  }
}
