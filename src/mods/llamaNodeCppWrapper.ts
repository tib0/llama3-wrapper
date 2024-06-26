import { type LlamaChatSession, type ChatHistoryItem, type LlamaModel, type Llama } from 'node-llama-cpp';
import { v4 as uuidv4 } from 'uuid';

/**
 * Enum representing different GPU types.
 */
export type Gpu = false | 'auto' | 'cuda' | 'vulkan' | 'metal' | undefined;

/**
 * Enum representing the status of a llama node.
 */
export type LlamaStatusType = 'uninitialized' | 'ready' | 'loading' | 'generating' | 'error';

/**
 * Exports a type definition for `ChatHistoryItem` from the 'node-llama-cpp' module.
 */
export { type ChatHistoryItem } from 'node-llama-cpp';

/**
 * Export LlamaStatus interface.
 * This is used to return the status of a llama node
 */
export interface LlamaStatus {
  status: LlamaStatusType;
  message: string;
}

/**
 * Interface for LlamaCppInfo
 * This is used to return information about a llama node.
 */
export interface LlamaCppInfo {
  /**
   * Unique ID of the running llama process
   */
  id?: string;

  /**
   * Information about the model use
   */
  model?: {
    /**
     * File name of the model
     */
    filename: string;
    /**
     * Size of the training context
     */
    trainContextSize: number;
  };

  /**
   * Information about the context
   */
  context?: {
    /**
     * Batch size used for training
     */
    batchSize: number;
    /**
     * Total size of the context
     */
    contextSize: number;
    /**
     * Number of sequences left to process
     */
    sequencesLeft: number;
    /**
     * Size of the state
     */
    stateSize: number;
    /**
     * Total number of sequences
     */
    totalSequences: number;
  };

  /**
   * Information about Llama
   */
  llama?: {
    /**
     * VRAM state information
     */
    vramState?: {
      /**
       * Total VRAM available
       */
      total: number;
      /**
       * Used VRAM
       */
      used: number;
      /**
       * Free VRAM
       */
      free: number;
    };
    /**
     * List of device names
     */
    deviceNames?: string[];
  };
}

/**
 * Loads and wraps the C++ llamaNode module in a TypeScript-friendly way.
 *
 * @returns A promise that resolves to the wrapped C++ llamaNode module.
 */
async function llamaModule(): Promise<typeof import('node-llama-cpp')> {
  return (await import('node-llama-cpp')) as typeof import('node-llama-cpp');
}

/**
 * LlamaWrapper class
 *
 * @class
 */
export class LlamaWrapper {
  private id: string;
  private session: LlamaChatSession | undefined;
  private status: LlamaStatus;
  private model: LlamaModel | undefined;
  private errorCallback: () => void;
  private abortController: AbortController;
  private module: typeof import('node-llama-cpp');
  private llama: Llama;

  /**
   * Initializes the wrapper with an ID and sets the status to uninitialized.
   *
   * @constructor
   */
  constructor() {
    this.setStatus('uninitialized', 'Wrapper not initialized');
    this.id = uuidv4();
    this.abortController = new AbortController();
    this.errorCallback = () => {
      this.abortController.abort();
      if (this.session) this.session.dispose();
    };
  }

  /**
   * Sets the status of the wrapper.
   *
   * @param {string} status - The new status of the wrapper.
   * @param {string} [payload] - An optional payload for the status update.
   */
  private setStatus(status: LlamaStatusType, payload?: string) {
    this.status = { status, message: payload };
  }

  /**
   * Gets the current status of the wrapper.
   *
   * @returns {LlamaStatus}
   */
  public getStatus() {
    return this.status;
  }

  /**
   * Checks if the wrapper is ready to use.
   *
   * @returns {boolean} Whether the wrapper is ready or not.
   */
  public isReady() {
    return this.status.status === 'ready';
  }

  /**
   * Checks if the wrapper is ready to use.
   *
   * @returns {boolean} Whether the wrapper is ready or not.
   */
  public getId() {
    return this.id;
  }

  /**
   * Gets information about the wrapper's current state.
   *
   * @returns {LlamaCppInfo}
   */
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

  /**
   * Disposes of the session.
   *
   * @throws {Error} If no session is found.
   */
  public disposeSession() {
    if (!this.session) {
      this.setStatus('error', String('disposeSession: No session found.'));
      throw new Error(`Ignoring attempt to dispose session, no session found.`);
    }
    this.session.dispose();
  }

  /**
   * Clears the history of the session.
   *
   * @throws {Error} If no session or sequence is found.
   */
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

  /**
   * Loads the Llama module asynchronously.
   *
   * @returns {Promise<void>} A promise that resolves when the loading is complete.
   * @throws {Error} If an error occurs during loading.
   */
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

  /**
   * Loads the Llama library asynchronously.
   *
   * @param {Gpu} [gpu] - The GPU to use (optional, defaults to 'auto').
   * @returns {Promise<void>} A promise that resolves when the loading is complete.
   * @throws {Error} If an error occurs during loading.
   */
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

  /**
   * Loads a model asynchronously.
   *
   * @param {string} modelPath - The path to the model file.
   * @returns {Promise<void>} A promise that resolves when the loading is complete.
   * @throws {Error} If an error occurs during loading.
   */
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

  /**
   * Initializes a session asynchronously.
   *
   * @param {string} systemPrompt - The system prompt for the session.
   * @returns {Promise<void>} A promise that resolves when the initialization is complete.
   * @throws {Error} If an error occurs during initialization.
   */
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

  /**
   * Prompts the Llama library asynchronously and returns the response.
   *
   * @param {string} message - The prompt to send to the Llama library.
   * @param {(chunk: string) => void} [onToken] - A callback function for tokenized responses (optional).
   * @returns {Promise<string>} A promise that resolves with the response from the Llama library.
   * @throws {Error} If an error occurs during prompting.
   */
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

  /**
   * Retrieves the chat history asynchronously and returns it.
   *
   * @returns {Promise<ChatHistoryItem[]>} A promise that resolves with the chat history.
   * @throws {Error} If an error occurs during history retrieval.
   */
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

  /**
   * Sets the chat history asynchronously.
   *
   * @param {ChatHistoryItem[]} chatHistoryItems - The new chat history to set.
   * @returns {Promise<void>} A promise that resolves when the setting is complete.
   * @throws {Error} If an error occurs during history updating.
   */
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
}
