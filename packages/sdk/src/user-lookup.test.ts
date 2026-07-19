import { describe, it, expect } from "vitest";
import { createUserLookup, registerUser } from "./user-lookup";

describe("createUserLookup", () => {
  it("getUser returns null for unknown user", async () => {
    const api = createUserLookup();
    expect(await api.getUser("unknown")).toBeNull();
  });

  it("getUser returns registered user", async () => {
    registerUser({ userId: "u1", fullName: "Alice", email: "alice@example.com" });
    const api = createUserLookup();
    const user = await api.getUser("u1");
    expect(user?.fullName).toBe("Alice");
    expect(user?.email).toBe("alice@example.com");
  });

  it("getUsers returns map of known users", async () => {
    registerUser({ userId: "u2", username: "bob" });
    registerUser({ userId: "u3", username: "charlie" });
    const api = createUserLookup();
    const map = await api.getUsers(["u1", "u2", "u3", "unknown"]);
    expect(map.size).toBe(3);
    expect(map.get("u2")?.username).toBe("bob");
    expect(map.has("unknown")).toBe(false);
  });
});
