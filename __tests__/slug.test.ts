import { describe, it, expect } from "vitest";
import { randomSlug, generateUniqueSlug } from "@/lib/slug";

describe("randomSlug", () => {
  it("returns a string of the requested length", () => {
    expect(randomSlug(8)).toHaveLength(8);
    expect(randomSlug(1)).toHaveLength(1);
    expect(randomSlug(32)).toHaveLength(32);
  });

  it("uses only lowercase alphanumeric characters", () => {
    for (let i = 0; i < 50; i += 1) {
      expect(randomSlug(12)).toMatch(/^[a-z0-9]{12}$/);
    }
  });

  it("defaults to length 8", () => {
    expect(randomSlug()).toHaveLength(8);
  });

  it("rejects length < 1", () => {
    expect(() => randomSlug(0)).toThrow();
    expect(() => randomSlug(-3)).toThrow();
  });

  it("produces varied slugs across calls", () => {
    const set = new Set<string>();
    for (let i = 0; i < 100; i += 1) set.add(randomSlug(8));
    expect(set.size).toBeGreaterThan(90);
  });
});

function buildLookup(taken: Set<string>) {
  return {
    findOne(filter: { slug: string }) {
      return {
        select() {
          return {
            lean(): Promise<unknown> {
              return Promise.resolve(
                taken.has(filter.slug) ? { _id: "x" } : null,
              );
            },
          };
        },
      };
    },
  };
}

describe("generateUniqueSlug", () => {
  it("returns a slug not present in the model", async () => {
    const taken = new Set<string>();
    const slug = await generateUniqueSlug(buildLookup(taken), 6);
    expect(slug).toMatch(/^[a-z0-9]{6}$/);
    expect(taken.has(slug)).toBe(false);
  });

  it("retries until a free slug is found", async () => {
    const taken = new Set<string>();
    let calls = 0;
    const lookup = {
      findOne(filter: { slug: string }) {
        return {
          select() {
            return {
              lean(): Promise<unknown> {
                calls += 1;
                if (calls < 3) {
                  taken.add(filter.slug);
                  return Promise.resolve({ _id: "x" });
                }
                return Promise.resolve(null);
              },
            };
          },
        };
      },
    };

    const slug = await generateUniqueSlug(lookup, 4);
    expect(slug).toMatch(/^[a-z0-9]{4}$/);
    expect(calls).toBeGreaterThanOrEqual(3);
  });

  it("throws if no free slug is found within the retry budget", async () => {
    const lookup = {
      findOne() {
        return {
          select() {
            return {
              lean(): Promise<unknown> {
                return Promise.resolve({ _id: "always-taken" });
              },
            };
          },
        };
      },
    };

    await expect(generateUniqueSlug(lookup, 2)).rejects.toThrow(
      /no free slug/,
    );
  });
});
