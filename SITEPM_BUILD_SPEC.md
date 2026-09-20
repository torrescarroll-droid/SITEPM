# SITEPM BUILD SPEC
## Cursor-Ready MVP Development Specification

**Product:** SITEPM  
**Positioning:** AI Operating Layer for Construction  
**Immediate Objective:** Build a secure, usable contractor MVP that can be used by Contractor #1 on a real project.  
**Primary Milestone:** A contractor can log in from phone or computer, open a project, upload documents, add field information, ask project-specific questions, receive grounded answers, see tasks/follow-ups, and receive a useful AI briefing.

**Accepted implementation (documentation pointer, not a scope change):** Projects, Tasks, Field Logs, and Documents are complete through their current milestones (`feat: add secure project documents`). Next implementation is Ask SITEPM / Intelligence V1 over that project information. Long-term Property, Construction, Regulatory, and bilingual architecture lives in `docs/PRODUCT_ARCHITECTURE.md` and is **not** V1 scope.

---

# 1. PRODUCT PRINCIPLE

SITEPM is not being built as a giant construction software suite in V1.

The V1 purpose is to answer one question:

> Can SITEPM understand a contractor's project well enough that the contractor begins relying on it?

SITEPM should increasingly help users understand what is happening, what requires attention, what is overdue, what information is missing, what could delay the project, what follow-up should happen next, and where the supporting information came from.

AI may prepare, analyze, summarize, flag, draft, and recommend. Humans must approve consequential actions such as financial commitments, change orders, purchase orders, contractual dates, payments, external messages, and legal/compliance decisions.

---

# 2. TARGET USER

Initial customers:
- Small and midsize residential general contractors
- Design-build firms
- Specialty contractors
- Approximately $2M-$30M annual revenue
- Multiple active projects
- Small administrative/project-management teams

Initial roles:
- Contractor/owner
- Project manager
- Superintendent
- Foreman

---

# 3. V1 PRODUCT SCOPE

Build ONLY these major capabilities for the first contractor MVP:

1. Authentication
2. Companies and users
3. Projects
4. Project documents
5. Ask SITEPM
6. Field logs
7. Field photos
8. Tasks / follow-ups
9. AI daily/project briefing
10. Responsive phone + desktop interface

Everything must share the same backend and database.

---

# 4. CORE USER EXPERIENCE

A user should be able to:

1. Create an account
2. Sign in securely
3. Belong to a company
4. Create/open a project
5. Upload project documents
6. Add project details
7. Add a field log
8. Upload/take a field photo
9. Create tasks
10. Ask SITEPM a project-specific question
11. Receive an answer grounded in project information
12. See the source used for the answer
13. See a project briefing identifying items requiring attention
14. Approve a suggested follow-up/task
15. Use the same project from phone and desktop

Example ideal experience:

> Good morning. Three things require your attention.
>
> 1. The electrician cannot start Tuesday because panel approval is outstanding.
> 2. The client's flooring selection is four days overdue and threatens the install date.
> 3. Yesterday's field log indicates a condition that may conflict with the project documents.
>
> Here are the relevant project references.
>
> Would you like me to create the follow-up tasks?

Do not implement autonomous sending/actions in V1.

---

# 5. TECH STACK

Use this stack unless there is a strong technical reason not to:

## Frontend
- Next.js
- React
- TypeScript
- Responsive web application
- Mobile-first where appropriate
- PWA-ready architecture

## Backend / Database
- Supabase
- PostgreSQL
- Supabase Auth
- Supabase Storage
- Supabase Row Level Security

## Hosting
- Vercel

## AI
- OpenAI API
- All API calls server-side
- Never expose production API keys in browser code

## Version Control
- Git
- GitHub

---

# 6. ARCHITECTURE PRINCIPLES

Build one responsive application, not separate desktop and mobile apps.

Phone experience emphasizes:
- AI briefing
- Field logs
- Camera/photos
- Ask SITEPM
- Tasks
- Quick project information

Desktop experience emphasizes:
- Project overview
- Documents
- Project details
- Tasks
- Field activity
- Deeper AI interaction

Both use the same database, authentication, company, project data, AI, and permissions.

---

# 7. MULTI-TENANT SECURITY

This is a critical requirement.

Every important record must belong to a company. Users from Company A must NEVER be able to access Company B data.

Hierarchy:

Company → Users → Projects → Documents → Tasks → Field Logs → Photos → AI interactions/references

Use Supabase Row Level Security.

Test with at least:
- Fake Company A
- Fake Company B

A user from Company A must not be able to read, edit, or retrieve Company B data even by manually changing URLs or IDs.

Security must be enforced in the database, not only hidden in the UI.

---

# 8. INITIAL DATABASE MODEL

Keep V1 simple.

## companies
- id
- name
- created_at

## profiles / users
- id
- auth_user_id
- company_id
- full_name
- email
- role
- created_at

Initial roles:
- owner
- admin
- project_manager
- superintendent
- field

## projects
- id
- company_id
- name
- client_name
- address
- status
- start_date
- target_completion_date
- description
- created_at
- updated_at

## tasks
- id
- company_id
- project_id
- title
- description
- assigned_to
- due_date
- priority
- status
- ai_suggested
- created_at
- completed_at

## field_logs
- id
- company_id
- project_id
- created_by
- log_date
- notes
- issue_flag
- created_at

## documents
- id
- company_id
- project_id
- filename
- storage_path
- document_type
- uploaded_by
- created_at

Initial document types:
- contract
- plans
- specifications
- schedule
- selections
- change_order
- other

## photos
- id
- company_id
- project_id
- field_log_id
- storage_path
- caption
- uploaded_by
- created_at

Add additional tables only when required by a working feature. Do not over-design the schema.

---

# 9. INITIAL APPLICATION SCREENS

## Login
- Email
- Password
- Sign in
- Sign up
- Logout

## Dashboard
Show:
- Active projects
- Items requiring attention
- Overdue tasks
- Recent field activity
- AI briefing

## Projects
- List projects
- Create project
- Open project

## Project Detail
Tabs/sections:
- Overview
- Ask SITEPM
- Documents
- Field
- Tasks

## Ask SITEPM
- Project-specific chat
- Questions scoped to current project
- Show source/reference when possible
- Do not fabricate answers when information is unavailable

## Documents
- Upload PDF
- Assign category
- View filename
- Open document
- Associate document to correct project

## Field
- New field log
- Notes
- Photo capture/upload
- Issue flag
- Date
- Project association

## Tasks
- Create task
- Assign
- Due date
- Status
- Priority
- AI suggested indicator

---

# 10. AI PROJECT BRAIN

The AI layer must be project-grounded. Do not build a generic chatbot.

Ask SITEPM V1 uses **Project Knowledge** already stored (projects, tasks, field logs, documents). It does not require a property graph, a general construction corpus, a jurisdiction/code corpus, or bilingual interpretation. Prefer citing project evidence; if information is missing, say so. Do not invent project facts from generic construction knowledge. Future knowledge classes are defined in `docs/PRODUCT_ARCHITECTURE.md`.

Basic pipeline:

Project documents / field logs / tasks / project data
→ extract usable text/data
→ divide document text into searchable chunks
→ retrieve relevant information for user question
→ send only relevant context to AI
→ generate answer
→ return answer with source references

Example:

User:
> What does the contract say about change orders?

SITEPM:
> The contract requires written approval before additional work is treated as an approved change order.

Source:
> Construction Contract.pdf — Section 8

If SITEPM cannot find the answer, it should say so:

> I could not find that requirement in the uploaded project documents.

Do NOT invent a plausible construction answer when the request is asking about project-specific information.

---

# 11. AI DAILY BRIEFING

This is a core differentiator.

The briefing should analyze available project information and identify what deserves attention.

Initial inputs:
- Overdue tasks
- Upcoming task deadlines
- Field logs
- Flagged issues
- Missing information
- Document activity
- Project dates

Initial output should contain:
1. Issue
2. Why it matters
3. Relevant source/data
4. Recommended next action

AI can recommend creating a task, following up, reviewing a document, confirming a selection, or verifying a field condition. Human approval is required for consequential actions.

---

# 12. FIELD EXPERIENCE

Field workflows must be extremely simple.

Target workflow:

Field → New Log → choose/open project → take/upload photo → dictate or type notes → flag issue if needed → save

Do not force field workers through complex administrative forms.

---

# 13. MOBILE UX

The application must work cleanly on iPhone-sized screens.

Phone UI should use:
- Large touch targets
- Cards instead of dense tables when possible
- Minimal typing
- Camera/photo access
- Simple navigation
- Bottom navigation if appropriate

Suggested phone navigation:
- Home
- Projects
- Ask
- Field
- Tasks

Desktop can use sidebar navigation.

---

# 14. DEVELOPMENT RULES FOR CURSOR / AI CODING

1. Do not build the entire application in one prompt.
2. Before modifying code, inspect the existing project structure.
3. Do not redesign working UI unless explicitly asked.
4. Prefer the minimum change necessary to accomplish the current task.
5. After each feature: run the application, check for build errors, test manually, fix errors, then commit the stable version to Git.
6. Never expose OpenAI API keys, Supabase service-role keys, or private credentials in browser/client code.
7. Do not disable Row Level Security to "make it work."
8. Explain security-sensitive changes.
9. If uncertain, stop and explain the problem rather than inventing an architecture.
10. Do not add dependencies without a specific reason.

---

# 15. 12-WEEK BUILD SEQUENCE

Calendar below is the original V1 plan. **Status as of accepted Documents:** Weeks 1–6 product work for auth, Projects, Tasks, Field Logs (without photos), and Documents is done. **Do not rebuild those.** Next implementation is Week 7–8 (AI foundation + Ask SITEPM) over existing Project Knowledge. Week 9 remains field **photos**. Long-term Property / knowledge corpora are not on this calendar.

## WEEK 1 — DEVELOPMENT SETUP

Goal: SITEPM runs locally and is backed up to GitHub.

Tasks:
- Install/open Cursor
- Install Node.js
- Install Git
- Set up GitHub
- GitHub Desktop optional
- Open SITEPM project folder
- Initialize repository
- Run project locally
- Open in Chrome
- Make one visible test change
- Commit change
- Push to GitHub
- Verify version history

DONE WHEN: SITEPM runs locally and the working version exists in GitHub.

DO NOT connect Supabase, AI, documents, or other services yet.

## WEEK 2 — UI SHELL

Goal: Responsive application shell.

Build desktop and phone navigation plus Dashboard, Projects, Project Detail, Ask SITEPM, Documents, Field, and Tasks using fake/demo data.

DONE WHEN: The same SITEPM codebase works cleanly at phone and desktop widths.

## WEEK 3 — DATABASE

Goal: Real data persists.

Create Supabase project and the initial companies, profiles/users, projects, tasks, and field_logs tables.

DONE WHEN: Create data → refresh browser → data still exists.

## WEEK 4 — AUTHENTICATION + SECURITY

Goal: Real login and tenant isolation.

Implement sign up, sign in, sign out, company membership, and Row Level Security.

DONE WHEN: Company A cannot access Company B projects.

## WEEK 5 — PROJECTS

Goal: Projects function end-to-end.

Build create/edit project, project overview, client, address, status, dates, description, tasks, and field logs.

DONE WHEN: A project can be created, edited, closed, reopened, and retains its information.

## WEEK 6 — DOCUMENTS

Goal: Project files can be stored.

Build Supabase Storage, PDF upload, document records, categories, project association, and open/view behavior.

DONE WHEN: A PDF uploaded to Project A can be opened later and is not visible to Company B.

## WEEK 7 — AI FOUNDATION

Goal: SITEPM can process uploaded project documents.

Build server-side OpenAI integration, PDF text extraction, document chunking, metadata, and retrieval preparation.

DONE WHEN: SITEPM can process and retrieve information from an uploaded document.

## WEEK 8 — ASK SITEPM

Goal: Project-grounded AI Q&A.

Build project-specific chat, retrieval, answer generation, sources/references, and unknown-answer behavior.

DONE WHEN: User asks a real project question and gets a grounded answer with a source.

## WEEK 9 — FIELD

Goal: Capture field information from phone.

Build New Field Log, photo capture/upload, notes, date, issue flag, and project association.

DONE WHEN: A user can create a field log with a photo from a phone.

## WEEK 10 — AI BRIEFING

Goal: SITEPM identifies what needs attention.

Combine tasks, project dates, field logs, issues, and recent activity.

DONE WHEN: SITEPM generates a useful briefing based on actual project data.

## WEEK 11 — FOLLOW-UPS

Goal: AI recommendations become human-approved actions.

Build suggested task → user review → approve/edit → assign → due date → save.

DONE WHEN: SITEPM identifies an issue and the user can approve the proposed follow-up task.

## WEEK 12 — PILOT READY

Goal: Prepare for Contractor #1.

Test two fake companies, permissions, login errors, mobile use, large PDFs, duplicate uploads, missing information, unknown AI questions, slow/broken network behavior, and unauthorized IDs/URLs.

Deploy through Vercel.

DONE WHEN: SITEPM works from phone and computer and can safely be shown to Contractor #1.

---

# 16. PILOT SUCCESS CRITERIA

Measure:
- Does the contractor return repeatedly?
- Does SITEPM save PM/admin time?
- Does it identify missed follow-ups?
- Does it make documents easier to use?
- Does the briefing surface something useful?
- Does the contractor trust project-grounded answers?
- Does field entry get used?
- Would the contractor be disappointed if SITEPM disappeared?
- Would the contractor pay?

Phase-1 validation milestone:

> 5 contractors + real projects + repeat usage + identifiable value + at least 1 willing to pay.

---

# 17. DO NOT BUILD YET

These are OUT OF SCOPE for the contractor MVP unless explicitly authorized later:

- SITEPM Acquire
- Flip underwriting
- Airbnb / STR analysis
- BRRRR analysis
- Property lead generation
- Pocket Handyman
- Consumer application
- Construction Skill Graph
- Professional body-camera capture network
- Robotics
- Physical AI
- Robot control
- Advanced computer vision
- Full accounting
- Payroll
- Full CRM
- Full estimating suite
- Advanced takeoff
- Buildertrend migration
- Complex native iOS/Android applications
- Deep offline synchronization
- Advanced scheduling engine
- Vendor marketplace
- Insurance features
- Autonomous purchasing
- Autonomous client communication
- Autonomous financial commitments

Do not add these simply because they appear elsewhere in SITEPM strategy materials.

---

# 18. LONG-TERM CONTEXT — FOR UNDERSTANDING ONLY

Long-term vision:

SITEPM Construction Intelligence Platform
→ Contractor / Project Intelligence
→ Living Property Record
→ Construction + Regulatory Knowledge (California-first, nationally expandable)
→ English/Spanish construction field bridge
→ SITEPM Field / Tool Belt
→ SITEPM Acquire
→ Construction Skill Graph
→ Pocket Handyman
→ Physical AI

Canonical long-term architecture (knowledge classes, evidence/provenance, document intelligence, ingest, privacy classes): `docs/PRODUCT_ARCHITECTURE.md`, `docs/DATA_INGESTION_ARCHITECTURE.md`, `docs/DATA_SOURCE_REGISTRY.md`.

This context exists so architecture decisions do not unnecessarily block future expansion. It is NOT permission to build these products during V1, create property tables, ingest external datasets, or start Ask SITEPM from an architecture pass.

---

# 19. DESIGN PHILOSOPHY

SITEPM should feel:
- Professional
- Modern
- Calm
- Field-friendly
- Construction-specific
- Intelligent without feeling complicated

Avoid:
- Consumer gimmicks
- Excessive animation
- Dense enterprise UI
- AI novelty for its own sake
- Too many dashboards
- Unnecessary clicks

The user should quickly understand:

> What requires my attention?

---

# 20. WORKING METHOD

For every development session:

### START
1. Open/pull latest stable version
2. Run locally
3. Confirm current app works
4. State today's single objective

### BUILD
5. Make only changes required for the objective
6. Test in browser
7. Test phone layout when relevant
8. Fix errors

### END
9. Commit working version
10. Push to GitHub
11. Record:

**DONE:** What was completed.  
**NEXT:** The next exact action.  
**BLOCKED:** Anything preventing progress.

---

# 21. PRIMARY GOVERNING QUESTION

Whenever scope becomes unclear, use this question:

> What is the next action that gets SITEPM closer to Contractor #1 relying on it on a real project?

If a proposed feature does not help answer that question during V1, defer it.

---

# 22. FIRST CURSOR INSTRUCTION

When this file is first added to the SITEPM repository, give Cursor this exact instruction:

> Read SITEPM_BUILD_SPEC.md completely before making changes. Do not build anything yet. Inspect the existing repository and explain:
> 1. what framework and structure currently exist,
> 2. whether the project can run locally,
> 3. what is missing for Week 1,
> 4. the smallest next action required.
>
> Do not redesign the application, install unnecessary packages, connect Supabase, or add AI yet. The immediate objective is only to establish a clean local development and Git/GitHub workflow.

---

# 23. DEFINITION OF SUCCESS FOR THE FIRST 12 WEEKS

By the end of the initial build period, a contractor should be able to:

> Sign in → open a real project → upload project information → record field activity → ask project-specific questions → receive grounded answers → see sources → manage tasks → receive a useful AI briefing → use SITEPM from phone and desktop without another company's information being exposed.

That is the MVP.

Everything after that depends on what real contractors actually do with it.
