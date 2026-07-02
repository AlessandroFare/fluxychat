import { describe, it, expect } from "vitest";
import { validateLimit, validatePositiveInteger } from "./validation.js";

describe("validateLimit", () => {
  it("returns the default value for missing, null, undefined, or empty input", () => {
    expect(validateLimit(undefined).value).toBe(20);
    expect(validateLimit(null).value).toBe(20);
    expect(validateLimit("").value).toBe(20);
    expect(validateLimit("  ").value).toBe(20);
  });

  it("uses opts.defaultValue when provided", () => {
    expect(validateLimit(undefined, { defaultValue: 50 }).value).toBe(50);
    expect(validateLimit(null, { defaultValue: 100 }).value).toBe(100);
  });

  it("parses valid numeric strings and numbers", () => {
    expect(validateLimit("10").value).toBe(10);
    expect(validateLimit(42).value).toBe(42);
    expect(validateLimit("100").value).toBe(100);
  });

  it("clamps values above opts.max", () => {
    expect(validateLimit("5000", { max: 1000 }).value).toBe(1000);
    expect(validateLimit(200, { max: 100 }).value).toBe(100);
  });

  it("does not clamp when opts.max is not set", () => {
    expect(validateLimit("5000").value).toBe(1000);
  });

  it("rejects zero, negative, and non-integer values", () => {
    expect(validateLimit("0").error).toBe("limit must be a positive integer");
    expect(validateLimit(0).error).toBe("limit must be a positive integer");
    expect(validateLimit("-5").error).toBe("limit must be a positive integer");
    expect(validateLimit(-5).error).toBe("limit must be a positive integer");
    expect(validateLimit("3.5").error).toBe("limit must be a positive integer");
    expect(validateLimit(3.5).error).toBe("limit must be a positive integer");
  });

  it("rejects non-numeric and boolean values", () => {
    expect(validateLimit("abc").error).toBe("limit must be a positive integer");
    expect(validateLimit("12abc").error).toBe("limit must be a positive integer");
    expect(validateLimit(NaN).error).toBe("limit must be a positive integer");
    expect(validateLimit(Infinity).error).toBe("limit must be a positive integer");
    expect(validateLimit(true).error).toBe("limit must be a positive integer");
    expect(validateLimit(false).error).toBe("limit must be a positive integer");
    expect(validateLimit({}).error).toBe("limit must be a positive integer");
    expect(validateLimit([]).error).toBe("limit must be a positive integer");
  });

  it("trims whitespace in numeric strings", () => {
    expect(validateLimit("  25  ").value).toBe(25);
  });

  it("throws when throwOnError is true", () => {
    expect(() => validateLimit("abc", { throwOnError: true })).toThrow("limit must be a positive integer");
    expect(() => validateLimit("0", { throwOnError: true })).toThrow("limit must be a positive integer");
    expect(() => validateLimit(undefined, { throwOnError: true })).not.toThrow();
  });

  it("returns numeric values within the allowed range unchanged", () => {
    expect(validateLimit("1").value).toBe(1);
    expect(validateLimit(1000).value).toBe(1000);
  });
});

describe("validatePositiveInteger", () => {
  it("parses valid numeric strings and numbers", () => {
    expect(validatePositiveInteger("1").value).toBe(1);
    expect(validatePositiveInteger("42").value).toBe(42);
    expect(validatePositiveInteger(99).value).toBe(99);
  });

  it("rejects missing, null, undefined, or empty input", () => {
    expect(validatePositiveInteger(undefined).error).toBe("value is required");
    expect(validatePositiveInteger(null).error).toBe("value is required");
    expect(validatePositiveInteger("").error).toBe("value is required");
  });

  it("uses opts.fieldName in error messages", () => {
    expect(validatePositiveInteger(undefined, { fieldName: "page" }).error).toBe("page is required");
    expect(validatePositiveInteger("abc", { fieldName: "id" }).error).toBe("id must be a positive integer");
  });

  it("rejects zero, negative, and non-integer values", () => {
    expect(validatePositiveInteger("0").error).toBe("value must be a positive integer");
    expect(validatePositiveInteger(0).error).toBe("value must be a positive integer");
    expect(validatePositiveInteger("-1").error).toBe("value must be a positive integer");
    expect(validatePositiveInteger(-100).error).toBe("value must be a positive integer");
    expect(validatePositiveInteger("2.5").error).toBe("value must be a positive integer");
    expect(validatePositiveInteger(2.5).error).toBe("value must be a positive integer");
  });

  it("rejects non-numeric and boolean values", () => {
    expect(validatePositiveInteger("abc").error).toBe("value must be a positive integer");
    expect(validatePositiveInteger(NaN).error).toBe("value must be a positive integer");
    expect(validatePositiveInteger(Infinity).error).toBe("value must be a positive integer");
    expect(validatePositiveInteger(true).error).toBe("value must be a positive integer");
    expect(validatePositiveInteger(false).error).toBe("value must be a positive integer");
    expect(validatePositiveInteger({}).error).toBe("value must be a positive integer");
    expect(validatePositiveInteger([]).error).toBe("value must be a positive integer");
  });

  it("throws when throwOnError is true", () => {
    expect(() => validatePositiveInteger(undefined, { throwOnError: true })).toThrow("value is required");
    expect(() => validatePositiveInteger("abc", { throwOnError: true })).toThrow("value must be a positive integer");
    expect(() => validatePositiveInteger("0", { throwOnError: true })).toThrow("value must be a positive integer");
  });

  it("does not throw for valid input when throwOnError is true", () => {
    expect(validatePositiveInteger("42", { throwOnError: true }).value).toBe(42);
  });
});
