export interface CodexContentPart {
  type?: string;
  text?: string;
}

export interface CodexOutputItem {
  id?: string;
  type?: string;
  call_id?: string;
  name?: string;
  arguments?: string;
  content?: CodexContentPart[];
}

export interface CodexStreamResponse {
  id?: string;
  output?: CodexOutputItem[];
  output_text?: string;
  error?: { message?: string };
  usage?: { input_tokens?: number; output_tokens?: number; total_tokens?: number };
}

interface StreamEvent {
  type?: string;
  response?: CodexStreamResponse;
  item?: CodexOutputItem;
  error?: unknown;
  delta?: unknown;
  text?: unknown;
  part?: unknown;
}

export function parseCodexEventStream(stream: string, emptyMessage = "Codex không trả về nội dung."): CodexStreamResponse {
  let completed: CodexStreamResponse | null = null;
  const completedItems: CodexOutputItem[] = [];
  const textDeltas: string[] = [];
  let completedText = "";

  for (const line of stream.split(/\r?\n/)) {
    if (!line.startsWith("data:")) continue;
    const raw = line.slice(5).trim();
    if (!raw || raw === "[DONE]") continue;

    let event: StreamEvent;
    try {
      event = JSON.parse(raw) as StreamEvent;
    } catch {
      continue;
    }

    if (event.type === "response.completed" && event.response) completed = event.response;
    else if (event.type === "response.output_item.done" && event.item) completedItems.push(event.item);
    else if (event.type === "response.output_text.delta" && typeof event.delta === "string") textDeltas.push(event.delta);
    else if (event.type === "response.output_text.done" && typeof event.text === "string") completedText = event.text;
    else if (event.type === "response.content_part.done" && event.part && typeof event.part === "object") {
      const part = event.part as CodexContentPart;
      if ((part.type === "output_text" || part.type === "text") && typeof part.text === "string") completedText = part.text;
    } else if (event.type === "response.failed" || event.type === "error") {
      throw new Error(`Codex không xử lý được yêu cầu: ${JSON.stringify(event.error || event).slice(0, 400)}`);
    }
  }

  const output = mergeOutputItems(completed?.output || [], completedItems);
  const result: CodexStreamResponse = completed
    ? { ...completed, output }
    : { id: crypto.randomUUID(), output };
  const streamedText = (completedText || textDeltas.join("")).trim();

  if (streamedText && !responseText(result)) {
    result.output = [
      ...(result.output || []),
      { type: "message", content: [{ type: "output_text", text: streamedText }] },
    ];
  }

  if (result.output?.length || result.output_text?.trim()) return result;
  throw new Error(emptyMessage);
}

export function responseText(response: CodexStreamResponse) {
  if (typeof response.output_text === "string" && response.output_text.trim()) return response.output_text.trim();
  const parts: string[] = [];
  for (const item of response.output || []) {
    if (item.type !== "message" || !Array.isArray(item.content)) continue;
    for (const content of item.content) {
      if ((content.type === "output_text" || content.type === "text") && typeof content.text === "string") parts.push(content.text);
    }
  }
  return parts.join("\n").trim();
}

function mergeOutputItems(primary: CodexOutputItem[], streamed: CodexOutputItem[]) {
  const merged: CodexOutputItem[] = [];
  const seen = new Set<string>();
  for (const item of [...primary, ...streamed]) {
    const key = item.id
      ? `id:${item.id}`
      : item.call_id
        ? `call:${item.call_id}`
        : `value:${JSON.stringify(item)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(item);
  }
  return merged;
}
