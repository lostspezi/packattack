import { describe, it, expect } from "vitest";
import { CHAT_CLIENT_BUFFER_LIMIT } from "@/lib/chat-constants";
import {
  capChatMessageSummaries,
  mergeChatMessageSummaries,
} from "@/lib/chat-message-summary";
import type { ChatMessageSummary } from "@/types/chat";

function makeMessage(overrides: Partial<ChatMessageSummary> & { id: string; visibleSeq: number | null }): ChatMessageSummary {
  const base: ChatMessageSummary = {
    id: overrides.id,
    roomSlug: "global",
    submissionSeq: overrides.visibleSeq ?? 0,
    visibleSeq: overrides.visibleSeq,
    body: "",
    gif: null,
    highlightCard: null,
    battleInvite: null,
    quotedMessage: null,
    status: "visible",
    author: null,
    mentionTargets: [],
    hasLink: false,
    hasMention: false,
    reactions: [],
    isDeleted: false,
    deletedReason: null,
    createdAt: new Date(2026, 0, 1, 0, 0, overrides.visibleSeq ?? 0).toISOString(),
    updatedAt: new Date(2026, 0, 1, 0, 0, overrides.visibleSeq ?? 0).toISOString(),
  };
  return { ...base, ...overrides };
}

describe("mergeChatMessageSummaries", () => {
  it("appends a new message and sorts by visibleSeq", () => {
    const a = makeMessage({ id: "a", visibleSeq: 1 });
    const c = makeMessage({ id: "c", visibleSeq: 3 });
    const b = makeMessage({ id: "b", visibleSeq: 2 });

    const result = mergeChatMessageSummaries([a, c], b);

    expect(result.map((m) => m.id)).toEqual(["a", "b", "c"]);
  });

  it("replaces an existing message with the same id", () => {
    const a = makeMessage({ id: "a", visibleSeq: 1, body: "old" });
    const aUpdated = makeMessage({ id: "a", visibleSeq: 1, body: "new" });

    const result = mergeChatMessageSummaries([a], aUpdated);

    expect(result).toHaveLength(1);
    expect(result[0].body).toBe("new");
  });

  it("drops oldest messages once the buffer limit is exceeded", () => {
    const seed: ChatMessageSummary[] = Array.from({ length: CHAT_CLIENT_BUFFER_LIMIT }, (_, i) =>
      makeMessage({ id: `m${i}`, visibleSeq: i }),
    );
    const next = makeMessage({ id: "newest", visibleSeq: CHAT_CLIENT_BUFFER_LIMIT });

    const result = mergeChatMessageSummaries(seed, next);

    expect(result).toHaveLength(CHAT_CLIENT_BUFFER_LIMIT);
    expect(result[0].id).toBe("m1");
    expect(result[result.length - 1].id).toBe("newest");
  });

  it("respects an explicit lower limit", () => {
    const a = makeMessage({ id: "a", visibleSeq: 1 });
    const b = makeMessage({ id: "b", visibleSeq: 2 });
    const c = makeMessage({ id: "c", visibleSeq: 3 });

    const result = mergeChatMessageSummaries([a, b], c, 2);

    expect(result.map((m) => m.id)).toEqual(["b", "c"]);
  });

  it("does not grow when only updating an existing message at the cap", () => {
    const seed: ChatMessageSummary[] = Array.from({ length: 5 }, (_, i) =>
      makeMessage({ id: `m${i}`, visibleSeq: i }),
    );
    const update = makeMessage({ id: "m2", visibleSeq: 2, body: "edited" });

    const result = mergeChatMessageSummaries(seed, update, 5);

    expect(result).toHaveLength(5);
    expect(result.find((m) => m.id === "m2")?.body).toBe("edited");
  });

  it("ignores updates to messages already evicted by the cap", () => {
    // Buffer holds the 3 newest. An update for an older, evicted message
    // arrives — it must not get re-inserted as if it were new.
    const seed: ChatMessageSummary[] = [
      makeMessage({ id: "m5", visibleSeq: 5 }),
      makeMessage({ id: "m6", visibleSeq: 6 }),
      makeMessage({ id: "m7", visibleSeq: 7 }),
    ];
    const stale = makeMessage({ id: "m1", visibleSeq: 1, body: "edited far in the past" });

    const result = mergeChatMessageSummaries(seed, stale, 3);

    expect(result.map((m) => m.id)).toEqual(["m5", "m6", "m7"]);
  });
});

describe("capChatMessageSummaries", () => {
  it("returns the same array when below the limit", () => {
    const messages = [
      makeMessage({ id: "a", visibleSeq: 1 }),
      makeMessage({ id: "b", visibleSeq: 2 }),
    ];

    const result = capChatMessageSummaries(messages);

    expect(result).toBe(messages);
  });

  it("keeps only the latest messages when above the limit", () => {
    const messages: ChatMessageSummary[] = Array.from({ length: 10 }, (_, i) =>
      makeMessage({ id: `m${i}`, visibleSeq: i }),
    );

    const result = capChatMessageSummaries(messages, 3);

    expect(result.map((m) => m.id)).toEqual(["m7", "m8", "m9"]);
  });
});
