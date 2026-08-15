import { describe, it, expect } from "vitest";
import { applyThinking } from "../../open-sse/translator/concerns/thinkingUnified.js";

function apply(model, body) {
  const out = JSON.parse(JSON.stringify(body));
  applyThinking("openai", model, out, "qwen");
  return out;
}

describe("Qwen native reasoning_effort passthrough", () => {
  it("preserves an explicitly supplied high reasoning_effort", () => {
    const out = apply("qwen3-max", {
      reasoning_effort: "high",
      chat_template_kwargs: { custom_flag: true },
    });

    expect(out.reasoning_effort).toBe("high");
    expect(out.enable_thinking).toBeUndefined();
    expect(out.thinking_budget).toBeUndefined();
    expect(out.chat_template_kwargs).toEqual({ custom_flag: true });
  });

  it("keeps the legacy Qwen translation for non-high effort", () => {
    const out = apply("qwen3-max", { reasoning_effort: "medium" });

    expect(out.reasoning_effort).toBeUndefined();
    expect(out.enable_thinking).toBe(true);
    expect(out.thinking_budget).toBe(8192);
  });

  it("keeps model-suffix overrides higher priority than the request field", () => {
    const out = apply("qwen3-max(low)", { reasoning_effort: "high" });

    expect(out.reasoning_effort).toBeUndefined();
    expect(out.enable_thinking).toBe(true);
    expect(out.thinking_budget).toEqual(expect.any(Number));
  });
});
