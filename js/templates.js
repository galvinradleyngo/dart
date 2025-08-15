// templates.js
export const DEFAULT_TEMPLATES = {
  analyze: [
    { title: "Design Blueprint – Parts A–D", role: "ld", collaborators: ["sme"], targetDays: 5, businessDays: true },
    { title: "Sign-off: Department Chairperson", role: "chair", targetDays: 3, businessDays: true, dependsOnIndex: [0] },
    { title: "Sign-off: Dean", role: "dean", targetDays: 3, businessDays: true, dependsOnIndex: [1] },
    { title: "Design Blueprint – Part E", role: "ld", collaborators: ["sme"], targetDays: 7, businessDays: true, dependsOnIndex: [2] },
    { title: "Sign-off: SME", role: "sme", targetDays: 3, businessDays: true, dependsOnIndex: [3] }
  ],
  design: [
    { title: "Create Course Template in Canvas", role: "md", targetDays: 1 },
    { title: "Set up Section E in Canvas", role: "ld", targetDays: 2, dependsOnIndex: [0] },
    { title: "Create Media Production Checklist", role: "ld", targetDays: 2, dependsOnIndex: [1] },
    { title: "Confirm Media Production Checklist", role: "md", targetDays: 2, dependsOnIndex: [2] }
  ],
  mediaChains: {
    video: [
      { title: "Script Outline", role: "sme", targetDays: 3 },
      { title: "Script Review & Draft", role: "ld", targetDays: 2, dependsOnIndex: [0] },
      { title: "Pre-Production Review", role: "ld", collaborators:["md"], targetDays: 1, dependsOnIndex: [1] },
      { title: "Schedule Production", role: "ld", targetDays: 1, dependsOnIndex: [2] },
      { title: "Asset Prep", role: "md", targetDays: 2, dependsOnIndex: [3] },
      { title: "Production (enter 1–3 dates)", role: "ld", targetDays: 0, variableDate: true, dependsOnIndex: [4] },
      { title: "Finalize Editing Script", role: "ld", targetDays: 1, dependsOnIndex: [5] },
      { title: "First Edit", role: "md", targetDays: 3, dependsOnIndex: [6] },
      { title: "Review Draft 1", role: "ld", targetDays: 2, dependsOnIndex: [7] },
      { title: "Revised / Final Edit", role: "md", targetDays: 3, dependsOnIndex: [8] },
      { title: "Prepare Transcript", role: "md", targetDays: 1, dependsOnIndex: [9] },
      { title: "QA: Finalized Video (PC)", role: "pc", targetDays: 2, dependsOnIndex: [9] },
      { title: "Upload to Drive", role: "md", targetDays: 1, dependsOnIndex: [10,11] },
      { title: "Embed in LMS Page", role: "md", targetDays: 1, dependsOnIndex: [10,11] },
      { title: "Confirm Placement", role: "ld", targetDays: 1, dependsOnIndex: [12,13] }
    ],
    slides: [
      { title: "Turnover Outline/Info", role: "ld", targetDays: 0 },
      { title: "Draft 1", role: "md", targetDays: 2, dependsOnIndex: [0] },
      { title: "Review Draft 1", role: "ld", targetDays: 2, dependsOnIndex: [1] },
      { title: "Final Edits & Completion", role: "md", targetDays: 2, dependsOnIndex: [2] },
      { title: "Final Approval", role: "ld", targetDays: 1, dependsOnIndex: [3] }
    ],
    infographic: [
      { title: "Turnover Outline/Info", role: "ld", targetDays: 0 },
      { title: "Draft 1", role: "md", targetDays: 2, dependsOnIndex: [0] },
      { title: "Review Draft 1", role: "ld", targetDays: 2, dependsOnIndex: [1] },
      { title: "Final Edits & Completion", role: "md", targetDays: 2, dependsOnIndex: [2] },
      { title: "Final Approval", role: "ld", targetDays: 1, dependsOnIndex: [3] }
    ],
    handout: [
      { title: "Turnover Outline/Info", role: "ld", targetDays: 0 },
      { title: "Draft 1", role: "md", targetDays: 2, dependsOnIndex: [0] },
      { title: "Review Draft 1", role: "ld", targetDays: 2, dependsOnIndex: [1] },
      { title: "Final Edits & Completion", role: "md", targetDays: 2, dependsOnIndex: [2] },
      { title: "Final Approval", role: "ld", targetDays: 1, dependsOnIndex: [3] }
    ]
  },
  implement: [
    { title: "Final Review – SME", role: "sme", targetDays: 2 },
    { title: "Final Review – PC", role: "pc", targetDays: 2 },
    { title: "Final Review – LD", role: "ld", targetDays: 2 },
    { title: "Provision for Final Edits", role: "ld", targetDays: 2, dependsOnRoleTitles: ["sme","pc","ld"] },
    { title: "Creation of Implementation Guide", role: "ld", targetDays: 2 },
    { title: "Turnover: Course + Implementation Guide to Dept. Chair", role: "ld", targetDays: 2, dependsOnTitle: "Creation of Implementation Guide" }
  ]
};
