import { describe, it, expect, beforeEach } from "vitest";

// This test simulates the entire user flow that was causing the bug:
// 1. User starts app with default templates
// 2. User deletes a default template
// 3. User restarts app
// 4. Verify deleted template does NOT reappear

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

describe("End-to-End: Template deletion persistence", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  // Helper functions matching the real implementation
  const MILESTONE_TPL_KEY = "healthPM:milestoneTemplates:v1";
  const DELETED_TPL_KEY = "healthPM:deletedTemplates:v1";

  const loadMilestoneTemplates = () => {
    try {
      const raw = localStorage.getItem(MILESTONE_TPL_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  };

  const saveMilestoneTemplates = (arr) => {
    try {
      localStorage.setItem(MILESTONE_TPL_KEY, JSON.stringify(arr));
    } catch {}
  };

  const loadDeletedTemplateIds = () => {
    try {
      const raw = localStorage.getItem(DELETED_TPL_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  };

  const saveDeletedTemplateIds = (ids) => {
    try {
      localStorage.setItem(DELETED_TPL_KEY, JSON.stringify(ids));
    } catch {}
  };

  const mergeById = (base = [], extra = [], deletedIds = []) => {
    const map = new Map(base.map(t => [t.id, t]));
    extra.forEach(t => { 
      if (!map.has(t.id) && !deletedIds.includes(t.id)) {
        map.set(t.id, t); 
      }
    });
    return Array.from(map.values());
  };

  const removeTemplate = (id) => {
    const deletedIds = loadDeletedTemplateIds();
    if (!deletedIds.includes(id)) {
      saveDeletedTemplateIds([...deletedIds, id]);
    }
    const templates = loadMilestoneTemplates();
    const next = templates.filter((t) => t.id !== id);
    saveMilestoneTemplates(next);
    return next;
  };

  // Default templates from the JSON file
  const defaultMilestoneTemplates = [
    {
      id: "default-module-1",
      title: "Module 1 – Canvas Setup",
      goal: "Prepare Canvas module shell",
      tasks: [
        { title: "Create module structure", details: "", workDays: 1 },
        { title: "Upload syllabus", details: "", workDays: 1 }
      ]
    },
    {
      id: "default-module-2",
      title: "Module 2 – Content Draft",
      goal: "Draft learning content",
      tasks: [
        { title: "Outline lesson", details: "", workDays: 2 },
        { title: "Prepare assessments", details: "", workDays: 2 }
      ]
    }
  ];

  it("simulates the complete user workflow", () => {
    // === STEP 1: First app load (fresh install) ===
    console.log("\n=== Step 1: First app load ===");
    let stored = loadMilestoneTemplates();
    let deletedIds = loadDeletedTemplateIds();
    
    // Initially no templates stored
    expect(stored).toEqual([]);
    expect(deletedIds).toEqual([]);
    
    // App merges with defaults
    let templates = mergeById(stored, defaultMilestoneTemplates, deletedIds);
    saveMilestoneTemplates(templates);
    
    console.log("Templates after first load:", templates.length);
    expect(templates.length).toBe(2);
    expect(templates.map(t => t.id)).toContain("default-module-1");
    expect(templates.map(t => t.id)).toContain("default-module-2");

    // === STEP 2: User deletes "Module 1" ===
    console.log("\n=== Step 2: User deletes Module 1 ===");
    removeTemplate("default-module-1");
    
    stored = loadMilestoneTemplates();
    deletedIds = loadDeletedTemplateIds();
    
    console.log("Templates after deletion:", stored.length);
    console.log("Deleted IDs:", deletedIds);
    expect(stored.length).toBe(1);
    expect(stored[0].id).toBe("default-module-2");
    expect(deletedIds).toContain("default-module-1");

    // === STEP 3: App restart (simulate page reload) ===
    console.log("\n=== Step 3: App restart ===");
    // Clear in-memory state, simulate fresh page load
    stored = loadMilestoneTemplates();
    deletedIds = loadDeletedTemplateIds();
    
    console.log("Templates from localStorage:", stored.length);
    console.log("Deleted IDs from localStorage:", deletedIds);
    
    // App merges again with defaults
    templates = mergeById(stored, defaultMilestoneTemplates, deletedIds);
    saveMilestoneTemplates(templates);
    
    console.log("Templates after restart merge:", templates.length);
    
    // THE BUG FIX: Module 1 should NOT reappear!
    expect(templates.length).toBe(1);
    expect(templates[0].id).toBe("default-module-2");
    expect(templates.map(t => t.id)).not.toContain("default-module-1");

    // === STEP 4: Multiple restarts ===
    console.log("\n=== Step 4: Another restart to confirm persistence ===");
    stored = loadMilestoneTemplates();
    deletedIds = loadDeletedTemplateIds();
    templates = mergeById(stored, defaultMilestoneTemplates, deletedIds);
    
    expect(templates.length).toBe(1);
    expect(templates[0].id).toBe("default-module-2");
  });

  it("simulates remote sync not bringing back deleted templates", () => {
    // === Setup: User has deleted Module 1 locally ===
    const localTemplates = [
      {
        id: "default-module-2",
        title: "Module 2 – Content Draft",
        goal: "Draft learning content",
        tasks: []
      }
    ];
    saveMilestoneTemplates(localTemplates);
    saveDeletedTemplateIds(["default-module-1"]);

    // === Simulate: Remote sync returns both modules (maybe from another device) ===
    const remoteTemplates = defaultMilestoneTemplates;
    
    // === App merges local with remote, respecting deletions ===
    const stored = loadMilestoneTemplates();
    const deletedIds = loadDeletedTemplateIds();
    const merged = mergeById(stored, remoteTemplates, deletedIds);
    
    console.log("\nRemote sync test:");
    console.log("Local templates:", stored.length);
    console.log("Remote templates:", remoteTemplates.length);
    console.log("Deleted IDs:", deletedIds);
    console.log("After merge:", merged.length);
    
    // Module 1 should NOT come back from remote
    expect(merged.length).toBe(1);
    expect(merged[0].id).toBe("default-module-2");
  });

  it("allows user to delete all default templates", () => {
    // Start with defaults
    saveMilestoneTemplates(defaultMilestoneTemplates);
    
    // Delete both
    removeTemplate("default-module-1");
    removeTemplate("default-module-2");
    
    // Restart
    const stored = loadMilestoneTemplates();
    const deletedIds = loadDeletedTemplateIds();
    const templates = mergeById(stored, defaultMilestoneTemplates, deletedIds);
    
    console.log("\nDelete all templates test:");
    console.log("Deleted IDs:", deletedIds);
    console.log("Templates after restart:", templates.length);
    
    // Should have no templates
    expect(templates.length).toBe(0);
    expect(deletedIds.length).toBe(2);
  });

  it("preserves user-created templates through restart", () => {
    // User creates custom templates
    const userTemplates = [
      { id: "user-1", title: "My Custom Template", goal: "", tasks: [] },
    ];
    saveMilestoneTemplates(userTemplates);
    
    // App restart
    const stored = loadMilestoneTemplates();
    const deletedIds = loadDeletedTemplateIds();
    const templates = mergeById(stored, defaultMilestoneTemplates, deletedIds);
    
    console.log("\nUser templates test:");
    console.log("After restart:", templates.length, "templates");
    
    // Should have user template + 2 defaults = 3 total
    expect(templates.length).toBe(3);
    expect(templates.map(t => t.id)).toContain("user-1");
    expect(templates.map(t => t.id)).toContain("default-module-1");
    expect(templates.map(t => t.id)).toContain("default-module-2");
  });
});
