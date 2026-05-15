export type TranslationSource = "local-free" | "api-bible-paid";

export interface PassagePolicyDecision {
  mayReturnInlineToModel: boolean;
  reason: string;
}

export function decideModelVisiblePassagePolicy(source: TranslationSource): PassagePolicyDecision {
  if (source === "local-free") {
    return { mayReturnInlineToModel: true, reason: "Local free WEB/KJV text may be returned inline." };
  }
  return {
    mayReturnInlineToModel: false,
    reason: "Paid API.Bible text is display-only and redacted from model-visible MCP output by default."
  };
}
