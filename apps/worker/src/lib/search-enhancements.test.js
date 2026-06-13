import { describe, it, expect } from "vitest";
import {
  saveSearch,
  listSavedSearches,
  deleteSavedSearch,
  recordSearchUse,
  createFolder,
  listFolders,
  addToFolder,
  removeFromFolder,
  getFolderItems,
  deleteFolder,
} from "./search-enhancements.js";

function createMockDb({ savedSearches = [], folders = [], folderItems = [] } = {}) {
  let nextId = 1;
  const db = {
    savedSearches, folders, folderItems,
    prepare(sql) {
      const self = this;
      return {
        bind(...args) {
          return {
            async all() {
              if (sql.includes("FROM saved_searches")) {
                return { results: self.savedSearches.filter((s) => s.project_id === args[0] && (s.user_id === args[1] || s.is_shared === 1)) };
              }
              if (sql.includes("FROM search_folders")) {
                return { results: self.folders.filter((f) => f.project_id === args[0] && f.user_id === args[1]) };
              }
              if (sql.includes("FROM search_folder_items")) {
                return { results: self.folderItems.filter((i) => i.folder_id === args[0]) };
              }
              return { results: [] };
            },
            async first() {
              if (sql.includes("FROM saved_searches")) {
                return self.savedSearches.find((s) => s.id === args[0] && s.project_id === args[1]) || null;
              }
              if (sql.includes("FROM search_folders")) {
                return self.folders.find((f) => f.id === args[0] && f.project_id === args[1]) || null;
              }
              return null;
            },
            async run() {
              if (sql.includes("INSERT INTO saved_searches")) {
                const s = { id: args[0], project_id: args[1], user_id: args[2], name: args[3], query: args[4], filters_json: args[5], use_count: 0, is_shared: 0, last_used_at: null, created_at: args[6], updated_at: args[7] };
                self.savedSearches.push(s);
                return { meta: { changes: 1 } };
              }
              if (sql.includes("DELETE FROM saved_searches")) {
                const before = self.savedSearches.length;
                self.savedSearches = self.savedSearches.filter((s) => s.id !== args[0]);
                return { meta: { changes: before - self.savedSearches.length } };
              }
              if (sql.includes("UPDATE saved_searches SET use_count")) {
                const s = self.savedSearches.find((s) => s.id === args[2]);
                if (s) { s.use_count = (s.use_count || 0) + 1; s.last_used_at = args[0]; s.updated_at = args[1]; }
                return { meta: { changes: 1 } };
              }
              if (sql.includes("INSERT INTO search_folders")) {
                const f = { id: args[0], project_id: args[1], user_id: args[2], name: args[3], description: args[4], created_at: args[5], updated_at: args[6] };
                self.folders.push(f);
                return { meta: { changes: 1 } };
              }
              if (sql.includes("DELETE FROM search_folders")) {
                const before = self.folders.length;
                self.folders = self.folders.filter((f) => f.id !== args[0]);
                self.folderItems = self.folderItems.filter((i) => i.folder_id !== args[0]);
                return { meta: { changes: before - self.folders.length } };
              }
              if (sql.includes("INSERT INTO search_folder_items")) {
                const i = { id: args[0], folder_id: args[1], search_id: args[2], sort_order: 0, created_at: args[4] };
                self.folderItems.push(i);
                return { meta: { changes: 1 } };
              }
              if (sql.includes("DELETE FROM search_folder_items")) {
                const before = self.folderItems.length;
                self.folderItems = self.folderItems.filter((i) => !(i.folder_id === args[0] && i.search_id === args[1]));
                return { meta: { changes: before - self.folderItems.length } };
              }
              return { meta: { changes: 0 } };
            },
          };
        },
      };
    },
  };
  return db;
}

describe("search-enhancements", () => {
  describe("saveSearch", () => {
    it("creates a saved search", async () => {
      const db = createMockDb();
      const result = await saveSearch({ DB: db }, {
        projectId: "p1", userId: "u1", name: "My Search", query: "hello world",
      });
      expect(result.ok).toBe(true);
      expect(result.id).toBeTruthy();
      expect(result.name).toBe("My Search");
    });
    it("rejects empty name", async () => {
      const db = createMockDb();
      const result = await saveSearch({ DB: db }, { projectId: "p1", userId: "u1", name: "", query: "q" });
      expect(result.ok).toBe(false);
      expect(result.error).toBe("name_required");
    });
    it("rejects empty query and filters", async () => {
      const db = createMockDb();
      const result = await saveSearch({ DB: db }, { projectId: "p1", userId: "u1", name: "My Search", query: "" });
      expect(result.ok).toBe(false);
      expect(result.error).toBe("query_or_filters_required");
    });
  });

  describe("listSavedSearches", () => {
    it("returns own and shared searches", async () => {
      const db = createMockDb({
        savedSearches: [
          { id: "s1", project_id: "p1", user_id: "u1", name: "own", query: "q1", filters_json: null, use_count: 0, is_shared: 0, last_used_at: null, created_at: "", updated_at: "" },
          { id: "s2", project_id: "p1", user_id: "u2", name: "shared", query: "q2", filters_json: null, use_count: 5, is_shared: 1, last_used_at: null, created_at: "", updated_at: "" },
          { id: "s3", project_id: "p1", user_id: "u3", name: "other", query: "q3", filters_json: null, use_count: 0, is_shared: 0, last_used_at: null, created_at: "", updated_at: "" },
        ],
      });
      const result = await listSavedSearches({ DB: db }, { projectId: "p1", userId: "u1" });
      expect(result.ok).toBe(true);
      expect(result.searches.length).toBe(2);
    });
  });

  describe("deleteSavedSearch", () => {
    it("deletes own search", async () => {
      const db = createMockDb({
        savedSearches: [
          { id: "s1", project_id: "p1", user_id: "u1", name: "own", query: "q", filters_json: null, use_count: 0, is_shared: 0, last_used_at: null, created_at: "", updated_at: "" },
        ],
      });
      const result = await deleteSavedSearch({ DB: db }, { projectId: "p1", userId: "u1", searchId: "s1" });
      expect(result.ok).toBe(true);
    });
    it("rejects missing search id", async () => {
      const db = createMockDb();
      const result = await deleteSavedSearch({ DB: db }, { projectId: "p1", userId: "u1", searchId: "" });
      expect(result.ok).toBe(false);
      expect(result.error).toBe("search_id_required");
    });
    it("rejects if not found", async () => {
      const db = createMockDb();
      const result = await deleteSavedSearch({ DB: db }, { projectId: "p1", userId: "u1", searchId: "missing" });
      expect(result.ok).toBe(false);
      expect(result.error).toBe("not_found");
    });
  });

  describe("recordSearchUse", () => {
    it("increments use count", async () => {
      const db = createMockDb({
        savedSearches: [
          { id: "s1", project_id: "p1", user_id: "u1", name: "own", query: "q", filters_json: null, use_count: 3, is_shared: 0, last_used_at: null, created_at: "", updated_at: "" },
        ],
      });
      await recordSearchUse({ DB: db }, "s1");
      expect(db.savedSearches[0].use_count).toBe(4);
    });
    it("does nothing if no id", async () => {
      const db = createMockDb();
      await recordSearchUse({ DB: db }, null);
    });
  });

  describe("createFolder", () => {
    it("creates a folder", async () => {
      const db = createMockDb();
      const result = await createFolder({ DB: db }, { projectId: "p1", userId: "u1", name: "My Folder" });
      expect(result.ok).toBe(true);
      expect(result.id).toBeTruthy();
    });
    it("rejects empty name", async () => {
      const db = createMockDb();
      const result = await createFolder({ DB: db }, { projectId: "p1", userId: "u1", name: "" });
      expect(result.ok).toBe(false);
      expect(result.error).toBe("name_required");
    });
  });

  describe("listFolders", () => {
    it("returns user folders", async () => {
      const db = createMockDb({
        folders: [
          { id: "f1", project_id: "p1", user_id: "u1", name: "F1", description: null, created_at: "", updated_at: "" },
          { id: "f2", project_id: "p1", user_id: "u2", name: "F2", description: null, created_at: "", updated_at: "" },
        ],
      });
      const result = await listFolders({ DB: db }, { projectId: "p1", userId: "u1" });
      expect(result.ok).toBe(true);
      expect(result.folders.length).toBe(1);
      expect(result.folders[0].name).toBe("F1");
    });
  });

  describe("addToFolder", () => {
    it("adds search to folder", async () => {
      const db = createMockDb({
        folders: [{ id: "f1", project_id: "p1", user_id: "u1", name: "F1", description: null, created_at: "", updated_at: "" }],
        savedSearches: [{ id: "s1", project_id: "p1", user_id: "u1", name: "S1", query: "q", filters_json: null, use_count: 0, is_shared: 0, last_used_at: null, created_at: "", updated_at: "" }],
      });
      const result = await addToFolder({ DB: db }, { projectId: "p1", userId: "u1", folderId: "f1", searchId: "s1" });
      expect(result.ok).toBe(true);
    });
    it("rejects if folder not found", async () => {
      const db = createMockDb();
      const result = await addToFolder({ DB: db }, { projectId: "p1", userId: "u1", folderId: "missing", searchId: "s1" });
      expect(result.ok).toBe(false);
      expect(result.error).toBe("folder_not_found");
    });
  });

  describe("removeFromFolder", () => {
    it("removes search from folder", async () => {
      const db = createMockDb({
        folders: [{ id: "f1", project_id: "p1", user_id: "u1", name: "F1", description: null, created_at: "", updated_at: "" }],
        folderItems: [{ id: "i1", folder_id: "f1", search_id: "s1", sort_order: 0, created_at: "" }],
      });
      const result = await removeFromFolder({ DB: db }, { projectId: "p1", userId: "u1", folderId: "f1", searchId: "s1" });
      expect(result.ok).toBe(true);
    });
  });

  describe("getFolderItems", () => {
    it("returns items in folder", async () => {
      const db = createMockDb({
        folders: [{ id: "f1", project_id: "p1", user_id: "u1", name: "F1", description: null, created_at: "", updated_at: "" }],
        folderItems: [{ id: "i1", folder_id: "f1", search_id: "s1", sort_order: 0, created_at: "" }],
        savedSearches: [{ id: "s1", project_id: "p1", user_id: "u1", name: "S1", query: "q", filters_json: null, use_count: 0, is_shared: 0, last_used_at: null, created_at: "", updated_at: "" }],
      });
      const result = await getFolderItems({ DB: db }, { projectId: "p1", userId: "u1", folderId: "f1" });
      expect(result.ok).toBe(true);
      expect(result.items.length).toBe(1);
      expect(result.folder.name).toBe("F1");
    });
    it("rejects missing folder", async () => {
      const db = createMockDb();
      const result = await getFolderItems({ DB: db }, { projectId: "p1", userId: "u1", folderId: "missing" });
      expect(result.ok).toBe(false);
      expect(result.error).toBe("folder_not_found");
    });
  });

  describe("deleteFolder", () => {
    it("deletes folder and items", async () => {
      const db = createMockDb({
        folders: [{ id: "f1", project_id: "p1", user_id: "u1", name: "F1", description: null, created_at: "", updated_at: "" }],
        folderItems: [{ id: "i1", folder_id: "f1", search_id: "s1", sort_order: 0, created_at: "" }],
      });
      const result = await deleteFolder({ DB: db }, { projectId: "p1", userId: "u1", folderId: "f1" });
      expect(result.ok).toBe(true);
      expect(db.folders.length).toBe(0);
      expect(db.folderItems.length).toBe(0);
    });
    it("rejects if not found", async () => {
      const db = createMockDb();
      const result = await deleteFolder({ DB: db }, { projectId: "p1", userId: "u1", folderId: "missing" });
      expect(result.ok).toBe(false);
      expect(result.error).toBe("not_found");
    });
  });
});
