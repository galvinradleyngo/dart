import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  loadMilestoneTemplates,
  saveMilestoneTemplates,
  loadDeletedTemplateIds,
  saveDeletedTemplateIds,
  removeTemplate,
  addTemplate,
} from "./milestoneTemplatesStore.js";

// Mock localStorage
const localStorageMock = (() => {
  let store = {};
  return {
    getItem: (key) => store[key] || null,
    setItem: (key, value) => {
      store[key] = value.toString();
    },
    clear: () => {
      store = {};
    },
  };
})();

global.localStorage = localStorageMock;

// Mock Firebase
vi.mock("./firebase.js", () => ({
  db: {},
}));

describe("milestoneTemplatesStore deletion tracking", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("should track deleted template IDs", () => {
    // Initially empty
    expect(loadDeletedTemplateIds()).toEqual([]);

    // Add a deleted ID
    saveDeletedTemplateIds(["template-1"]);
    expect(loadDeletedTemplateIds()).toEqual(["template-1"]);

    // Add more deleted IDs
    saveDeletedTemplateIds(["template-1", "template-2"]);
    expect(loadDeletedTemplateIds()).toEqual(["template-1", "template-2"]);
  });

  it("should add template ID to deleted list when removeTemplate is called", () => {
    // Add a template first
    const templates = [
      { id: "tpl-1", title: "Template 1", goal: "", tasks: [] },
      { id: "tpl-2", title: "Template 2", goal: "", tasks: [] },
    ];
    saveMilestoneTemplates(templates);

    // Initially no deleted IDs
    expect(loadDeletedTemplateIds()).toEqual([]);

    // Remove a template
    removeTemplate("tpl-1");

    // Check that the ID was added to deleted list
    expect(loadDeletedTemplateIds()).toContain("tpl-1");

    // Check that template was removed from storage
    const stored = loadMilestoneTemplates();
    expect(stored.length).toBe(1);
    expect(stored[0].id).toBe("tpl-2");
  });

  it("should not duplicate deleted IDs when removing same template twice", () => {
    const templates = [
      { id: "tpl-1", title: "Template 1", goal: "", tasks: [] },
    ];
    saveMilestoneTemplates(templates);

    // Remove template
    removeTemplate("tpl-1");
    expect(loadDeletedTemplateIds()).toEqual(["tpl-1"]);

    // Try to remove again (shouldn't add duplicate)
    removeTemplate("tpl-1");
    expect(loadDeletedTemplateIds()).toEqual(["tpl-1"]);
  });

  it("should persist deleted IDs across localStorage operations", () => {
    // Save some deleted IDs
    saveDeletedTemplateIds(["default-module-1", "default-module-2"]);

    // Simulate page reload by reading from localStorage
    const deletedIds = loadDeletedTemplateIds();
    expect(deletedIds).toContain("default-module-1");
    expect(deletedIds).toContain("default-module-2");
  });
});
