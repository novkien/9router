import { describe, expect, it } from "vitest";
import { createLocalReplaySignature, isValidClaudeSignature } from "../../open-sse/utils/claudeSignature.js";
import { openaiToClaudeResponse } from "../../open-sse/translator/response/openai-to-claude.js";

function state() {
  return { toolCalls: new Map(), nextBlockIndex: 0 };
}

describe("local reasoning replay signature", () => {
  it("is deterministic, opaque, and accepted by the local shape validator", () => {
    const a = createLocalReplaySignature("msg-1", "Qwen-27B", 0);
    const b = createLocalReplaySignature("msg-1", "Qwen-27B", 0);
    expect(a).toBe(b);
    expect(a).not.toContain("EXACT-RTRACE");
    expect(isValidClaudeSignature(a)).toBe(true);
  });

  it("emits signature_delta before thinking block stop", () => {
    const s = state();
    openaiToClaudeResponse({
      id: "chatcmpl-replay-test",
      model: "Qwen-27B",
      choices: [{ delta: { reasoning_content: "exact reasoning" } }],
    }, s);
    const events = openaiToClaudeResponse({
      id: "chatcmpl-replay-test",
      model: "Qwen-27B",
      choices: [{ delta: { content: "visible" }, finish_reason: "stop" }],
    }, s);
    const signature = events.find((e) => e.delta?.type === "signature_delta");
    const stop = events.find((e) => e.type === "content_block_stop");
    expect(signature?.delta.signature).toBeTruthy();
    expect(isValidClaudeSignature(signature.delta.signature)).toBe(true);
    expect(events.indexOf(signature)).toBeLessThan(events.indexOf(stop));
  });
});
