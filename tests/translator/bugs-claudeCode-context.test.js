// Real Claude Code CLI requests (Claude format) → non-Claude provider via OpenAI bridge.
// Focuses on context components a real CLI sends: system arrays w/ cache_control, thinking
// signatures, tool_result with images, audio. KNOWN BUG = it.fails (source file:line in comments).
import { describe, it, expect } from "vitest";
import "./registerAll.js";
import { translateRequest } from "../../open-sse/translator/index.js";
import { FORMATS } from "../../open-sse/translator/formats.js";

const T = (src, tgt, body, provider = null) =>
  translateRequest(src, tgt, "m", body, true, null, provider);

describe("Claude Code CLI context → OpenAI", () => {
  // claude-to-openai.js:24-27 — system array only maps .text; cache_control/non-text dropped
  it("system array keeps all text parts", () => {
    const out = T(FORMATS.CLAUDE, FORMATS.OPENAI, {
      system: [
        { type: "text", text: "You are Claude Code.", cache_control: { type: "ephemeral" } },
        { type: "text", text: "Follow repo conventions." },
      ],
      messages: [{ role: "user", content: "hi" }],
    });
    const sys = out.messages.find((m) => m.role === "system");
    expect(sys?.content).toContain("Claude Code");
    expect(sys?.content).toContain("repo conventions");
  });

  // claude→claude is passthrough (same format) → thinking preserved. Guards against
  // accidental routing through the OpenAI bridge for same-format requests.
  it("assistant thinking block survives Claude→Claude passthrough", () => {
    const out = T(FORMATS.CLAUDE, FORMATS.CLAUDE, {
      messages: [
        { role: "assistant", content: [
          { type: "thinking", thinking: "step-by-step plan", signature: "abc123" },
          { type: "text", text: "done" },
        ] },
        { role: "user", content: "next" },
      ],
    });
    expect(JSON.stringify(out)).toContain("step-by-step plan");
  });

  // claude-to-openai.js — thinking blocks map to OpenAI reasoning_content so
  // reasoning survives multi-turn history through the OpenAI bridge (Qwen/llama.cpp).
  it("assistant thinking block survives Claude→OpenAI via reasoning_content", () => {
    const out = T(FORMATS.CLAUDE, FORMATS.OPENAI, {
      messages: [
        { role: "assistant", content: [
          { type: "thinking", thinking: "step-by-step plan", signature: "abc123" },
          { type: "text", text: "done" },
        ] },
        { role: "user", content: "next" },
      ],
    });
    const asst = out.messages.find((m) => m.role === "assistant");
    expect(asst?.reasoning_content).toContain("step-by-step plan");
    expect(asst?.content).toBe("done");
  });

  // claude-to-openai.js — redacted_thinking preserved through reasoning_content
  it("redacted_thinking block is not silently dropped", () => {
    const out = T(FORMATS.CLAUDE, FORMATS.OPENAI, {
      messages: [
        { role: "assistant", content: [
          { type: "redacted_thinking", data: "ENCRYPTED_BLOB" },
          { type: "text", text: "answer" },
        ] },
        { role: "user", content: "go" },
      ],
    });
    const asst = out.messages.find((m) => m.role === "assistant");
    expect(asst?.reasoning_content).toContain("ENCRYPTED_BLOB");
    expect(asst?.content).toBe("answer");
  });

  // thinking + tool_use on the same assistant message → both survive
  it("thinking block survives alongside tool_calls", () => {
    const out = T(FORMATS.CLAUDE, FORMATS.OPENAI, {
      messages: [
        { role: "assistant", content: [
          { type: "thinking", thinking: "need tool", signature: "abc123" },
          { type: "tool_use", id: "call_1", name: "lookup", input: { q: "x" } },
        ] },
        { role: "user", content: [
          { type: "tool_result", tool_use_id: "call_1", content: "res" },
        ] },
      ],
    });
    const asst = out.messages.find((m) => m.role === "assistant");
    expect(asst?.reasoning_content).toContain("need tool");
    expect(asst?.tool_calls?.[0]?.id).toBe("call_1");
  });

  // thinking-only assistant message (no text) → reasoning_content with empty content
  it("thinking-only assistant message keeps reasoning_content", () => {
    const out = T(FORMATS.CLAUDE, FORMATS.OPENAI, {
      messages: [
        { role: "assistant", content: [
          { type: "thinking", thinking: "just thinking", signature: "abc123" },
        ] },
        { role: "user", content: "next" },
      ],
    });
    const asst = out.messages.find((m) => m.role === "assistant");
    expect(asst?.reasoning_content).toContain("just thinking");
    expect(asst?.content).toBe("");
  });

  // Claude Code puts Read/screenshot output inside tool_result.content. The
  // image must remain an OpenAI image_url instead of becoming JSON text.
  it("tool_result image block is preserved as multimodal content", () => {
    const out = T(FORMATS.CLAUDE, FORMATS.OPENAI, {
      messages: [
        { role: "assistant", content: [{ type: "tool_use", id: "call_1", name: "screenshot", input: {} }] },
        { role: "user", content: [
          { type: "tool_result", tool_use_id: "call_1", content: [
            { type: "image", source: { type: "base64", media_type: "image/png", data: "IMG" } },
          ] },
        ] },
      ],
    });
    const tool = out.messages.find((m) => m.role === "tool");
    expect(tool?.content).toEqual([
      {
        type: "image_url",
        image_url: { url: "data:image/png;base64,IMG" },
      },
    ]);
  });
});
