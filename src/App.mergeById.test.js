import { describe, it, expect, beforeEach } from "vitest";

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

describe("App.jsx mergeById with deletion tracking", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  // Simulate the mergeById function from App.jsx
  const mergeById = (base = [], extra = [], deletedIds = []) => {
    const map = new Map(base.map(t => [t.id, t]));
    extra.forEach(t => { 
      if (!map.has(t.id) && !deletedIds.includes(t.id)) {
        map.set(t.id, t); 
      }
    });
    return Array.from(map.values());
  };

  it("should merge templates without deleted IDs", () => {
    const stored = [
      { id: "user-1", title: "User Template 1" },
    ];
    const defaults = [
      { id: "default-1", title: "Default Template 1" },
      { id: "default-2", title: "Default Template 2" },
    ];
    const deletedIds = [];

    const merged = mergeById(stored, defaults, deletedIds);
    
    // Should have all 3 templates
    expect(merged.length).toBe(3);
    expect(merged.map(t => t.id)).toContain("user-1");
    expect(merged.map(t => t.id)).toContain("default-1");
    expect(merged.map(t => t.id)).toContain("default-2");
  });

  it("should exclude deleted default templates from merge", () => {
    const stored = [
      { id: "user-1", title: "User Template 1" },
    ];
    const defaults = [
      { id: "default-1", title: "Default Template 1" },
      { id: "default-2", title: "Default Template 2" },
    ];
    const deletedIds = ["default-1"]; // User deleted default-1

    const merged = mergeById(stored, defaults, deletedIds);
    
    // Should only have 2 templates (user-1 and default-2, NOT default-1)
    expect(merged.length).toBe(2);
    expect(merged.map(t => t.id)).toContain("user-1");
    expect(merged.map(t => t.id)).not.toContain("default-1");
    expect(merged.map(t => t.id)).toContain("default-2");
  });

  it("should not re-add deleted default templates on subsequent merges", () => {
    // Simulate first app load after deletion
    const stored = []; // Empty because user deleted all templates
    const defaults = [
      { id: "default-module-1", title: "Module 1 – Canvas Setup" },
      { id: "default-module-2", title: "Module 2 – Content Draft" },
    ];
    const deletedIds = ["default-module-1", "default-module-2"];

    const merged = mergeById(stored, defaults, deletedIds);
    
    // Should have 0 templates because both defaults were deleted
    expect(merged.length).toBe(0);
  });

  it("should keep user templates that aren't in defaults", () => {
    const stored = [
      { id: "user-created-1", title: "My Custom Template" },
      { id: "user-created-2", title: "Another Custom Template" },
    ];
    const defaults = [
      { id: "default-1", title: "Default Template 1" },
    ];
    const deletedIds = [];

    const merged = mergeById(stored, defaults, deletedIds);
    
    // Should have all 3
    expect(merged.length).toBe(3);
    expect(merged.map(t => t.id)).toContain("user-created-1");
    expect(merged.map(t => t.id)).toContain("user-created-2");
    expect(merged.map(t => t.id)).toContain("default-1");
  });

  it("should handle remote sync without re-adding deleted templates", () => {
    // User has templates locally
    const localTemplates = [
      { id: "user-1", title: "User Template" },
    ];
    
    // Remote has more templates including deleted ones
    const remoteTemplates = [
      { id: "user-1", title: "User Template" },
      { id: "default-module-1", title: "Module 1" },
    ];
    
    // User previously deleted default-module-1
    const deletedIds = ["default-module-1"];

    const merged = mergeById(localTemplates, remoteTemplates, deletedIds);
    
    // Should only have user-1, not default-module-1
    expect(merged.length).toBe(1);
    expect(merged[0].id).toBe("user-1");
  });
});
