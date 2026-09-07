import assert from "node:assert/strict";
import test from "node:test";
import { parseCodexEventStream, responseText } from "../lib/server/codex-stream.ts";

function sse(events) {
  return `${events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join("")}data: [DONE]\n\n`;
}

test("giữ function call từ output_item.done khi response.completed trả output rỗng", () => {
  const result = parseCodexEventStream(sse([
    {
      type: "response.output_item.done",
      output_index: 0,
      item: { id: "fc_1", type: "function_call", call_id: "call_1", name: "tra_cuu_cong_no", arguments: "{}" },
    },
    { type: "response.completed", response: { id: "resp_1", status: "completed", output: [] } },
  ]));

  assert.equal(result.output?.length, 1);
  assert.equal(result.output?.[0].type, "function_call");
  assert.equal(result.output?.[0].call_id, "call_1");
});

test("ghép text delta khi completed response không chứa message", () => {
  const result = parseCodexEventStream(sse([
    { type: "response.output_text.delta", delta: "Đã " },
    { type: "response.output_text.delta", delta: "tra cứu." },
    { type: "response.completed", response: { id: "resp_2", status: "completed", output: [] } },
  ]));

  assert.equal(responseText(result), "Đã tra cứu.");
});

test("không nhân đôi output item đã có trong completed response", () => {
  const item = { id: "msg_1", type: "message", content: [{ type: "output_text", text: "Xong" }] };
  const result = parseCodexEventStream(sse([
    { type: "response.output_item.done", output_index: 0, item },
    { type: "response.completed", response: { id: "resp_3", status: "completed", output: [item] } },
  ]));

  assert.equal(result.output?.length, 1);
  assert.equal(responseText(result), "Xong");
});
