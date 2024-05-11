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
    deviceNames?: string[];
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
  private module: typeof import('node-llama-cpp');
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
      };
    }
    if (this.model) {
      infos = {
        ...infos,
        model: {
          filename: this.model.filename,
          trainContextSize: this.model.trainContextSize,
        },
      };
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
      };
    }
    if (this.llama) {
      infos = {
        ...infos,
        llama: {
          vramState: this.llama.getVramState(),
          deviceNames: this.llama.getGpuDeviceNames(),
        },
      };
    }
    return infos;
  }

  public disposeSession() {
    if (!this.session) {
      this.setStatus('error', String('disposeSession: No session found.'));
      throw new Error(`Ignoring attempt to dispose session, no session found.`);
    }
    this.session.dispose();
  }

  public clearHistory() {
    if (!this.session) {
      this.setStatus('error', String('disposeSession: No session found.'));
      throw new Error(`Ignoring attempt to clear history, no session found.`);
    }
    if (!this.session.sequence) {
      this.setStatus('error', String('disposeSession: No sequence found for the session.'));
      throw new Error(`Ignoring attempt to clear history, no sequence found for the session.`);
    }
    this.session.sequence.clearHistory();
  }

  async loadModule() {
    try {
      this.setStatus('loading', `Loading module from Node Llama Cpp`);
      this.module = await llamaModule();
      this.setStatus('ready');
    } catch (err) {
      console.error(err);
      this.setStatus('error', String('loadModule:' + err.message));
      throw new Error(err);
    }
  }

  async loadLlama(gpu?: Gpu) {
    if (!this.module) {
      this.setStatus('error', String('loadLlama: No module found.'));
      throw new Error(`Ignoring attempt to load llama, no module found.`);
    }

    try {
      this.setStatus('loading', `Loading Llama lib`);

      this.llama = await this.module.getLlama({
        logLevel: this.module.LlamaLogLevel.warn,
        build: 'never',
        progressLogs: false,
        gpu: gpu || 'auto',
      });

      this.setStatus('ready');
    } catch (err) {
      console.error(err);
      this.setStatus('error', String('loadLlama: ' + err.message));
      throw new Error(err);
    }
  }

  async loadModel(modelPath: string) {
    if (!modelPath || modelPath === '') {
      this.setStatus('error', String('loadModel: No path provided.'));
      throw new Error(`Ignoring attempt to load model, no path provided.`);
    }
    if (!this.module) {
      this.setStatus('error', String('loadModel: No module found.'));
      throw new Error(`Ignoring attempt to load model, no module found.`);
    }
    if (!this.llama) {
      this.setStatus('error', String('loadModel: No llama lib loaded.'));
      throw new Error(`Ignoring attempt to load model, no llama lib loaded.`);
    }

    try {
      this.setStatus('loading', `Loading model from ${modelPath}`);

      this.model = await this.llama.loadModel({
        modelPath: modelPath,
      });

      this.setStatus('ready');
    } catch (err) {
      console.error(err);
      this.setStatus('error', String('loadModel: ' + err.message));
      throw new Error(err);
    }
  }

  async initSession(systemPrompt: string) {
    if (!this.model) {
      this.setStatus('error', String('initSession: No model loaded.'));
      throw new Error(`Ignoring attempt to initialize session, no model loaded.`);
    }
    if (!this.module) {
      this.setStatus('error', String('initSession: No module found.'));
      throw new Error(`Ignoring attempt to initialize session, no module found.`);
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
      this.setStatus('error', String('initSession: ' + err.message));
      throw new Error(err);
    }
  }

  public async prompt(message: string, onToken?: (chunk: string) => void): Promise<string> {
    if (this.session === undefined) {
      this.setStatus('error', String('prompt: No session found.'));
      throw new Error('Ignoring attempt to prompt, no session found');
    }

    this.setStatus('generating');

    try {
      const answer = await this.session.prompt(message, {
        onToken: (chunk) => {
          if (onToken !== undefined && this.session !== undefined) {
            const decoded = this.session.model.detokenize(chunk);
            onToken(decoded);
          }
        },
        signal: this.abortController.signal,
      });
      this.setStatus('ready');
      return answer;
    } catch (err) {
      this.errorCallback();
      this.setStatus('error', String('prompt: ' + err.message));
      throw new Error(err);
    }
  }

  public async getHistory(): Promise<ChatHistoryItem[]> {
    if (this.session === undefined) {
      this.setStatus('error', String('getHistory: No session found.'));
      throw new Error('Ignoring history retrieval, no session found');
    }

    this.setStatus('generating');

    try {
      const chatHistory = await this.session.getChatHistory();
      this.setStatus('ready', 'History retrieved');
      return chatHistory;
    } catch (err) {
      this.errorCallback();
      this.setStatus('error', String('getHistory: ' + err.message));
      throw new Error(err);
    }
  }

  public async setHistory(chatHistoryItem: ChatHistoryItem[]): Promise<void> {
    if (this.session === undefined) {
      this.setStatus('error', String('getHistory: No session found.'));
      throw new Error('Ignoring history update, no session found');
    }

    this.setStatus('loading', 'Loading chat history');

    try {
      await this.session.setChatHistory(chatHistoryItem);
      this.setStatus('ready', 'Chat history loaded');
    } catch (err) {
      this.errorCallback();
      this.setStatus('error', String('setHistory: ' + err.message));
      throw new Error(err);
    }
  }

  constructor() {
    this.setStatus('uninitialized', 'Wrapper not initialized');
    this.id = uuidv4();
    this.abortController = new AbortController();
    this.errorCallback = () => {
      this.abortController.abort();
      if (this.session) this.session.dispose();
    };
  }
}
