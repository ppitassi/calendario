import Groq from 'groq-sdk';

export type LeiaMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

type LeiaCompletionOptions = {
  messages: LeiaMessage[];
  temperature?: number;
  maxCompletionTokens?: number;
  responseFormat?: Record<string, unknown>;
};

function getLeiaClient() {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error('LEIA_NOT_CONFIGURED');
  return new Groq({ apiKey, timeout: 30_000, maxRetries: 1 });
}

export async function completeWithLeia(options: LeiaCompletionOptions) {
  const completion = await getLeiaClient().chat.completions.create({
    model: process.env.GROQ_MODEL || 'openai/gpt-oss-20b',
    messages: options.messages,
    temperature: options.temperature ?? 0.4,
    max_completion_tokens: options.maxCompletionTokens ?? 4096,
    stream: false,
    ...(options.responseFormat ? { response_format: options.responseFormat } : {})
  } as any);

  const content = completion.choices[0]?.message?.content?.trim();
  if (!content) throw new Error('LEIA_EMPTY_RESPONSE');
  return content;
}
