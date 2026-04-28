import { describe, it, expect } from "bun:test";
import { slugify, timeAgo } from "@/lib/utils";

describe("slugify", () => {
  it("converts normal text to slug", () => {
    expect(slugify("Hello World")).toBe("hello-world");
  });

  it("removes special characters", () => {
    expect(slugify("Hello! @World#")).toBe("hello-world");
  });

  it("collapses multiple spaces and hyphens", () => {
    expect(slugify("hello   world---test")).toBe("hello-world-test");
  });

  it("strips leading and trailing hyphens", () => {
    expect(slugify("--hello-world--")).toBe("hello-world");
  });

  it("removes unicode and emoji", () => {
    expect(slugify("hello 🎉 world")).toBe("hello-world");
  });

  it("returns empty string when no valid chars remain", () => {
    expect(slugify("🎉🎊🎈")).toBe("");
  });

  it("truncates to 100 characters", () => {
    const long = "a".repeat(200);
    expect(slugify(long).length).toBeLessThanOrEqual(100);
  });

  it("passes through an already-valid slug", () => {
    expect(slugify("hello-world")).toBe("hello-world");
  });

  it("converts underscores to hyphens", () => {
    expect(slugify("hello_world")).toBe("hello-world");
  });
});

describe("timeAgo", () => {
  it("returns 'just now' for less than 60 seconds", () => {
    const now = new Date();
    expect(timeAgo(now)).toBe("just now");
  });

  it("returns minutes ago", () => {
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
    expect(timeAgo(fiveMinAgo)).toBe("5m ago");
  });

  it("returns hours ago", () => {
    const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000);
    expect(timeAgo(threeHoursAgo)).toBe("3h ago");
  });

  it("returns days ago for less than 7 days", () => {
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    expect(timeAgo(twoDaysAgo)).toBe("2d ago");
  });

  it("returns locale date string for 7+ days", () => {
    const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
    const result = timeAgo(eightDaysAgo);
    // Should be a locale date string, not "Xd ago"
    expect(result).not.toContain("d ago");
    expect(result).not.toBe("just now");
  });

  it("accepts string date input", () => {
    const now = new Date().toISOString();
    expect(timeAgo(now)).toBe("just now");
  });

  it("accepts Date object input", () => {
    const now = new Date();
    expect(timeAgo(now)).toBe("just now");
  });
});
