import { type ChatHistoryItem } from 'node-llama-cpp';
import path from 'path';
import { fileURLToPath } from 'url';

export { type ChatHistoryItem } from 'node-llama-cpp';

export async function getSession(prompt: string, history?: ChatHistoryItem[]) {
  const { getLlama, LlamaChatSession } = (await import('node-llama-cpp')) as typeof import('node-llama-cpp');
  try {
    const __dirname = path.dirname(fileURLToPath(`file:${process.env.LLAMA_MODELS_LOCATION}`));
    const llama = await getLlama();
    const model = await llama.loadModel({
      modelPath: path.join(__dirname, process.env.LLAMA_MODEL_NAME),
    });
    const context = await model.createContext();
    const session = new LlamaChatSession({
      systemPrompt: prompt,
      contextSequence: context.getSequence(),
    });

    if (history) session.setChatHistory(history);

    return session;
  } catch (error) {
    throw new Error(error);
  }
}
