import crypto from "crypto";

// Claude thinking signature validation (ported from CLIProxyAPI internal/signature).
// E-form: single-layer base64, decoded[0] == 0x12 (Claude marker).
// R-form: double-layer base64, outer decoded[0] == 'E', inner decoded[0] == 0x12.
// Cache prefix "...#sig" stripped before validation.

const MAX_CLAUDE_SIGNATURE_LEN = 32 * 1024 * 1024;
const CLAUDE_SIGNATURE_MARKER = 0x12;

function stripCachePrefix(rawSignature) {
  const sig = (rawSignature || "").trim();
  if (!sig) return "";
  const idx = sig.indexOf("#");
  return idx >= 0 ? sig.slice(idx + 1).trim() : sig;
}

export function hasClaudeSignaturePrefix(rawSignature) {
  const sig = stripCachePrefix(rawSignature);
  return sig.length > 0 && (sig[0] === "E" || sig[0] === "R");
}

// Strict-ish: validates base64 layers + Claude marker byte.
export function isValidClaudeSignature(rawSignature) {
  const sig = stripCachePrefix(rawSignature);
  if (!sig || sig.length > MAX_CLAUDE_SIGNATURE_LEN) return false;

  try {
    if (sig[0] === "E") {
      const decoded = Buffer.from(sig, "base64");
      return decoded.length > 0 && decoded[0] === CLAUDE_SIGNATURE_MARKER;
    }
    if (sig[0] === "R") {
      const outer = Buffer.from(sig, "base64");
      if (!outer.length || outer[0] !== 0x45) return false; // 'E'
      const inner = Buffer.from(outer.toString(), "base64");
      return inner.length > 0 && inner[0] === CLAUDE_SIGNATURE_MARKER;
    }
    return false;
  } catch {
    return false;
  }
}

// Generate a deterministic opaque signature for reasoning produced by a local
// OpenAI-compatible upstream. It has the marker shape accepted by the Claude
// replay validator, but is explicitly not an Anthropic signature.
export function createLocalReplaySignature(messageId, model, blockIndex) {
  const secret = process.env.CLAUDE_THINKING_REPLAY_SECRET ||
    process.env.API_KEY_SECRET ||
    "9router-local-thinking-replay-v1";
  const material = `v1|${messageId || "message"}|${model || "model"}|${blockIndex}`;
  const digest = crypto.createHmac("sha256", secret).update(material).digest();
  return Buffer.concat([Buffer.from([CLAUDE_SIGNATURE_MARKER]), digest]).toString("base64");
}
