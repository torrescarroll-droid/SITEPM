export type ProjectStatus = "active" | "on_hold" | "complete";
export type TaskStatus = "open" | "in_progress" | "done";
export type TaskPriority = "high" | "medium" | "low";
export type DocumentType =
  | "contract"
  | "plans"
  | "specifications"
  | "schedule"
  | "selections"
  | "change_order"
  | "other";

export const company = {
  name: "Ridge Line Construction",
  userName: "Jordan Hale",
  role: "Project manager",
};

export const projects = [
  {
    id: "willow-ave",
    name: "184 Willow Ave Remodel",
    clientName: "Chen family",
    address: "184 Willow Ave, Tacoma, WA",
    status: "active" as ProjectStatus,
    startDate: "Jun 2, 2026",
    targetCompletionDate: "Nov 14, 2026",
    description:
      "Full interior remodel of a 1960s rambler: kitchen, two baths, electrical panel, and flooring.",
  },
  {
    id: "cedar-adu",
    name: "Cedar Street ADU",
    clientName: "Patel household",
    address: "902 Cedar St, Olympia, WA",
    status: "active" as ProjectStatus,
    startDate: "Apr 18, 2026",
    targetCompletionDate: "Dec 4, 2026",
    description:
      "New detached accessory dwelling unit with utility tie-ins and a compact kitchen.",
  },
  {
    id: "mill-barn",
    name: "Mill Creek Barn Conversion",
    clientName: "Ortiz family",
    address: "41 Mill Creek Rd, Puyallup, WA",
    status: "on_hold" as ProjectStatus,
    startDate: "Mar 3, 2026",
    targetCompletionDate: "TBD",
    description:
      "Barn-to-living conversion paused pending structural engineer comments.",
  },
];

export const briefingItems = [
  {
    id: "panel",
    projectId: "willow-ave",
    issue: "The electrician cannot start Tuesday because panel approval is outstanding.",
    why: "Rough electrical is on the critical path. A missed Tuesday start pushes inspection and drywall.",
    source: "Permit tracker · City of Tacoma electrical — still “awaiting approval.”",
    action: "Call the plans examiner and create a follow-up task for Jordan.",
  },
  {
    id: "flooring",
    projectId: "willow-ave",
    issue: "The client's flooring selection is four days overdue and threatens the install date.",
    why: "Lead time on the specified oak is 12 days. Install is currently shown for Oct 3.",
    source: "Selections.pdf · Kitchen flooring — decision due Sep 9.",
    action: "Send the selection reminder and hold a backup SKU with the vendor.",
  },
  {
    id: "field-conflict",
    projectId: "willow-ave",
    issue:
      "Yesterday's field log indicates a condition that may conflict with the project documents.",
    why: "Existing plumbing stack is 6\" off the drawing, which may affect the kitchen island.",
    source: "Field log · Sep 12 — flagged issue by superintendent.",
    action: "Review Sheet A-4 and confirm whether a change order is needed.",
  },
];

export const tasks = [
  {
    id: "t1",
    projectId: "willow-ave",
    title: "Confirm electrical panel approval",
    description: "Follow up with the city on the service upgrade permit.",
    assignedTo: "Jordan Hale",
    dueDate: "Sep 15, 2026",
    priority: "high" as TaskPriority,
    status: "open" as TaskStatus,
    overdue: true,
    aiSuggested: true,
  },
  {
    id: "t2",
    projectId: "willow-ave",
    title: "Collect flooring selection from client",
    description: "Need final oak vs. LVP decision before millwork lock.",
    assignedTo: "Maya Chen",
    dueDate: "Sep 9, 2026",
    priority: "high" as TaskPriority,
    status: "open" as TaskStatus,
    overdue: true,
    aiSuggested: true,
  },
  {
    id: "t3",
    projectId: "cedar-adu",
    title: "Schedule underground utility locate",
    description: "Required before foundation excavation next week.",
    assignedTo: "Chris Nguyen",
    dueDate: "Sep 17, 2026",
    priority: "medium" as TaskPriority,
    status: "in_progress" as TaskStatus,
    overdue: false,
    aiSuggested: false,
  },
  {
    id: "t4",
    projectId: "willow-ave",
    title: "Verify kitchen stack vs. Sheet A-4",
    description: "Field measurement conflict with island plumbing.",
    assignedTo: "Sam Ortiz",
    dueDate: "Sep 16, 2026",
    priority: "high" as TaskPriority,
    status: "open" as TaskStatus,
    overdue: false,
    aiSuggested: true,
  },
  {
    id: "t5",
    projectId: "cedar-adu",
    title: "Submit window order",
    description: "Andersen units for south elevation.",
    assignedTo: "Jordan Hale",
    dueDate: "Sep 22, 2026",
    priority: "low" as TaskPriority,
    status: "done" as TaskStatus,
    overdue: false,
    aiSuggested: false,
  },
];

export const fieldLogs = [
  {
    id: "f1",
    projectId: "willow-ave",
    createdBy: "Sam Ortiz",
    logDate: "Sep 12, 2026",
    notes:
      "Kitchen waste stack is 6 inches east of the location shown on Sheet A-4. Island DWV may not work as drawn.",
    issueFlag: true,
    photoCaption: "Existing stack at north wall",
  },
  {
    id: "f2",
    projectId: "cedar-adu",
    createdBy: "Chris Nguyen",
    logDate: "Sep 12, 2026",
    notes: "Footings formed. Rain overnight; covers in place. Ready for pour pending locate.",
    issueFlag: false,
    photoCaption: "Footing forms, south side",
  },
  {
    id: "f3",
    projectId: "willow-ave",
    createdBy: "Sam Ortiz",
    logDate: "Sep 11, 2026",
    notes: "Demo complete in kitchen. Client walked the space and asked again about island seating.",
    issueFlag: false,
    photoCaption: "Kitchen after demo",
  },
];

export const documents = [
  {
    id: "d1",
    projectId: "willow-ave",
    filename: "Construction Contract.pdf",
    documentType: "contract" as DocumentType,
    uploadedBy: "Jordan Hale",
    createdAt: "Jun 1, 2026",
  },
  {
    id: "d2",
    projectId: "willow-ave",
    filename: "Architectural Set A-1 to A-8.pdf",
    documentType: "plans" as DocumentType,
    uploadedBy: "Jordan Hale",
    createdAt: "Jun 4, 2026",
  },
  {
    id: "d3",
    projectId: "willow-ave",
    filename: "Selections.pdf",
    documentType: "selections" as DocumentType,
    uploadedBy: "Maya Chen",
    createdAt: "Aug 21, 2026",
  },
  {
    id: "d4",
    projectId: "cedar-adu",
    filename: "ADU Permit Set.pdf",
    documentType: "plans" as DocumentType,
    uploadedBy: "Jordan Hale",
    createdAt: "Apr 12, 2026",
  },
  {
    id: "d5",
    projectId: "cedar-adu",
    filename: "Window Schedule.xlsx.pdf",
    documentType: "specifications" as DocumentType,
    uploadedBy: "Chris Nguyen",
    createdAt: "Aug 2, 2026",
  },
];

export const askDemo = {
  projectId: "willow-ave",
  messages: [
    {
      role: "user" as const,
      text: "What does the contract say about change orders?",
    },
    {
      role: "sitepm" as const,
      text: "The contract requires written approval before additional work is treated as an approved change order.",
      source: "Construction Contract.pdf — Section 8",
    },
    {
      role: "user" as const,
      text: "What allowance did we carry for landscape lighting?",
    },
    {
      role: "sitepm" as const,
      text: "I could not find that requirement in the uploaded project documents.",
      source: null,
    },
  ],
};

export function getProject(id: string) {
  return projects.find((project) => project.id === id);
}

export function projectName(id: string) {
  return getProject(id)?.name ?? "Unknown project";
}
