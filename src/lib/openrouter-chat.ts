import "server-only";

function openRouterChatUrl(): string {
  const base =
    process.env.OPENROUTER_API_BASE_URL?.trim().replace(/\/$/, "") ||
    "https://openrouter.ai/api/v1";
  return `${base}/chat/completions`;
}

type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export async function completeOpenRouterChat(input: {
  messages: ChatMessage[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
}): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("AI review is not configured.");
  }

  const model =
    input.model?.trim() ||
    process.env.CARA_OPENROUTER_MODEL?.trim() ||
    "google/gemini-2.5-flash-lite";

  const response = await fetch(openRouterChatUrl(), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...(process.env.OPENROUTER_APP_TITLE?.trim()
        ? { "X-Title": process.env.OPENROUTER_APP_TITLE.trim() }
        : {}),
    },
    body: JSON.stringify({
      model,
      messages: input.messages,
      temperature: input.temperature ?? 0.2,
      max_tokens: input.maxTokens ?? 512,
      response_format: { type: "json_object" },
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(12_000),
  });

  if (!response.ok) {
    console.warn("[openrouter] chat_request_failed", { status: response.status });
    throw new Error("AI review failed.");
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  const content = payload.choices?.[0]?.message?.content?.trim();
  if (!content) {
    throw new Error("AI review returned an empty response.");
  }

  return content;
}
