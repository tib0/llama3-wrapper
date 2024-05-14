![logo](./.github/llama3-wrapper-banner.png)

# Llama3-Wrapper

A wrapper class for interacting with a LLaMA model instance loaded locally.
Use any gguf models, you can find models on [huggingface.co](https://huggingface.co/models?search=gguf).
This projects is based on llama.cpp by [ggerganov](https://github.com/ggerganov) used via node-llama-cpp by [withcatai](https://github.com/withcatai/).

## METHODS

### Constructor

Creates a new instance of the LlamaWrapper class, assigning it a unique ID and initializing its internal state.

### loadModule()

Loads the LLaMA module required for interacting with the model. Throws an error if the module cannot be loaded.

### loadLlama(gpu?: Gpu)

Loads the LLaMA library instance, optionally specifying a GPU device to use. Throws an error if the module isn't initialized.

### loadModel(modelPath: string)

Loads a specific LLaMA model from the specified modelPath. Throws an error if Llama isn't loaded.

### initSession(systemPrompt: string)

Initializes a new chat session with the wrapped LLaMA model using the specified systemPrompt. Throws an error if the model isn't initialized.

### getStatus()

Returns the current status of the wrapper as an object containing the status and optional message. The status can be one of LlamaStatusType (Uninitialized, Ready, Loading, Generating or Error).

### isReady()

Returns a boolean indicating whether the wrapper is in ready state.

### prompt(message: string, onToken?: (chunk: string) => void)

Generates an answer to the specified message and calls the optional onToken callback function with each generated chunk. Throws an error if the session isn't initialized.

### getHistory()

Retrieves the chat history associated with this wrapper's current session. Throws an error if no session is found.

### setHistory(chatHistoryItem: ChatHistoryItem[]): Promise

Sets the chat history associated with this wrapper's current session to the specified chatHistoryItem array. Throws an error if no session is found.

### getId()

Returns the unique ID assigned to this wrapper instance.

### getInfos()

Returns an object containing various information about the wrapped LLaMA model, including its ID, model filename, train context size, and more.

### disposeSession()

Disposes of the current chat session associated with this wrapper. Throws an error if no session is found.

### clearHistory()

Clears the history of the current chat sequence associated with this wrapper. Throws an error if no session or sequence is found.

## TYPES

### Gpu

The `Gpu` type represents a GPU device to use.

- **auto**: The default value, which means the library will automatically select the best available GPU.
- **cuda**: A CUDA-enabled GPU.
- **vulkan**: A VULKAN-enabled GPU.
- **metal**: A METAL-enabled GPU.
- **false**: Skip GPU usage.

### LlamaStatusType

The `LlamaStatusType` type defines the possible status values for a llama wrapper instance.

- **uninitialized**: The initial state of a new llama session.
- **loading**: The session is loading a model or initializing session.
- **ready**: The session is ready to use.
- **error**: An error occurred during initialization or loading.
- **generating**: The session is currently generating a response to a message.

### ChatHistoryItem

The `ChatHistoryItem` type represents a single item in the chat history, which contains the message and its corresponding response. Can be ChatSystemMessage | ChatUserMessage | ChatModelResponse

- **type**: The original message sent by the user. can be 'system', 'user' or 'model'.
- **text**: Represent the stored user text or system prompt. This property comes from ChatSystemMessage and ChatUserMessage types.
- **response**: Represent the model answer, comes from ChatModelResponse type.

## BUILDING FROM SOURCE

By following the steps below, you can build and install the module from source code.

1. Clone the repository:

```sh
git clone https://github.com/tib0/llama3-wrapper.git
```

2. Install dependencies:

```sh
cd ./llama3-wrapper
pnpm i
```

3. Build the module:

```sh
pnpm build
```

4. Link the module globally:

```sh
pnpm link -g
```

5. In the target project folder use the module:

```sh
cd /path/to/target-project
pnpm link -g llama3-wrapper
```

## CONFIGURATION

Add your GGUF model path in a .env file at the root of your project:

```sh
LLAMA_MODELS_PATH=/Users/me/example/LLM/Models/my-model-file.gguf
```

## EXAMPLE

Sample chat-like usage in terminal:

```ts
import { type ChatHistoryItem, LlamaWrapper } from 'llama3-wrapper';
import readline from 'readline';
import { spawn } from 'node:child_process';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const run = async () => {
  console.log(`# START LLAMA CHAT`);
  console.log(`\n`);

  console.log(`# Feeding history traces`);
  const history: ChatHistoryItem[] = [
    { type: 'user', text: 'Hey.' },
    { type: 'model', response: ['Hello !'] },
  ];

  console.log(`# Waiting seat allocation`);

  const llamaNodeCPP = new LlamaWrapper();
  await llamaNodeCPP.loadModule();
  await llamaNodeCPP.loadLlama();
  await llamaNodeCPP.loadModel(process.env.LLAMA_MODELS_PATH);
  await llamaNodeCPP.initSession(promptSystem);
  console.log(`# Prompt ready`);

  console.log(`# Activated TTS (voice)`);

  console.log(`\n`);
  rl.setPrompt('1 > ');
  rl.prompt();
  let i = 1;

  rl.on('line', async (q) => {
    if (!q || q === '' || q === 'exit' || q === 'quit' || q === 'q') {
      rl.close();
    } else {
      const a = await llamaNodeCPP.prompt(q);
      console.log(`${i} @ ${a}`);
      spawn('say', [a]);
      console.log(`\n`);
      i++;
    }
    rl.setPrompt(`${i} > `);
    rl.prompt();
  }).on('close', async () => {
    console.log(`\n`);
    console.log(`Disposing session...`);
    await llamaNodeCPP.disposeSession();
    console.log(`\n`);
    const a = await llamaNodeCPP.getHistory();
    console.log(`History:`);
    console.log(JSON.stringify(a));

    console.log(`\n`);
    console.log('# END LLAMA CHAT');

    process.exit(0);
  });
};

run();
```

# RESSOURCES

- [https://github.com/withcatai/node-llama-cpp](https://github.com/withcatai/node-llama-cpp): Run AI models locally on your machine with node.js bindings for llama.cpp. Force a JSON schema on the model output on the generation level.
- [https://github.com/ggerganov/llama.cpp](https://github.com/ggerganov/llama.cpp): official implementation of LLaMA in C++.
- [https://huggingface.co](https://huggingface.co): let's you explore the models and datasets available on the Hub.
- [https://github.com/facebookresearch/llama](https://github.com/facebookresearch/llama): official implementation of LLaMA.
