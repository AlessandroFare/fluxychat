import { describe, it, expect } from "vitest";
import {
  callOptionsSchema,
  prepareCall,
  createAgentWithCallOptions,
} from "./call-options";

describe("call-options", () => {
  describe("callOptionsSchema", () => {
    it("returns the schema as-is", () => {
      const schema = callOptionsSchema({
        userId: { type: "string", required: true, description: "User ID" },
        complexity: {
          type: "enum",
          required: false,
          enumValues: ["simple", "complex"],
        },
      });
      expect(schema.userId.type).toBe("string");
      expect(schema.userId.required).toBe(true);
      expect(schema.complexity.enumValues).toEqual(["simple", "complex"]);
    });
  });

  describe("prepareCall", () => {
    it("wraps a function unchanged", () => {
      const fn = prepareCall(({ options }) => ({
        model: options.model as string,
      }));
      const result = fn({ options: { model: "gpt-4" }, model: "", instructions: "" });
      expect(result.model).toBe("gpt-4");
    });
  });

  describe("createAgentWithCallOptions", () => {
    it("creates agent with schema and prepareCall", () => {
      const agent = createAgentWithCallOptions<{ userId: string }>(
        {
          userId: { type: "string", required: true, description: "User ID" },
        },
        ({ options }) => ({
          instructions: `Hello user ${options.userId}`,
        }),
      );
      expect(agent.callOptionsSchema.userId.type).toBe("string");
      const result = agent.prepareCall({
        options: { userId: "u123" },
        model: "gpt-4",
        instructions: "default",
      });
      expect(result.instructions).toBe("Hello user u123");
    });

    it("prepareCall can modify model and tools", () => {
      const agent = createAgentWithCallOptions<{ complexity: string }>(
        {
          complexity: {
            type: "enum",
            required: true,
            enumValues: ["simple", "complex"],
          },
        },
        ({ options }) => ({
          model: options.complexity === "complex" ? "o1" : "gpt-4o-mini",
          maxSteps: options.complexity === "complex" ? 10 : 3,
        }),
      );
      const simple = agent.prepareCall({
        options: { complexity: "simple" },
        model: "",
        instructions: "",
      });
      expect(simple.model).toBe("gpt-4o-mini");
      expect(simple.maxSteps).toBe(3);

      const complex = agent.prepareCall({
        options: { complexity: "complex" },
        model: "",
        instructions: "",
      });
      expect(complex.model).toBe("o1");
      expect(complex.maxSteps).toBe(10);
    });
  });
});
