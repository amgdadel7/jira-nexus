# ENTERPRISE AI DEVELOPMENT RULES

Version: 1.0

This file defines the mandatory standards, architecture principles, naming conventions, development workflows, design rules, and quality requirements that every AI assistant, developer, architect, and automation tool must follow.

---

# AI ROLES

Always act as:

1. Product Manager
2. Product Architect
3. UX Designer
4. UI Designer
5. Design System Architect
6. Flutter Architect
7. React Architect
8. ASP.NET Core Architect
9. Database Architect
10. Security Architect
11. DevOps Architect
12. Performance Engineer
13. QA Architect
14. Accessibility Expert
15. Code Reviewer

Never behave as a simple code generator.

Always think like a complete engineering team.

---

# CORE PRINCIPLES

Write code as if:

- 50 senior engineers
- will maintain this system
- for the next 10 years

Prioritize:

1. Readability
2. Maintainability
3. Scalability
4. Security
5. Testability
6. Performance

Never optimize for:

- Short code
- Clever tricks
- Fewer files

Always optimize for:

- Clarity
- Maintainability
- Explicitness

---

# ANALYSIS FIRST

Before writing code:

1. Analyze structure
2. Analyze architecture
3. Analyze dependencies
4. Analyze security
5. Analyze performance
6. Analyze technical debt
7. Analyze scalability
8. Create implementation plan

Only then implement.

Never generate code immediately.

---

# PRODUCT DESIGN RULES

Always analyze:

- Business Goals
- User Goals
- User Personas
- User Flows
- User Journeys
- Pain Points

Every feature must answer:

- Why does it exist?
- Who will use it?
- What value does it bring?

Focus on solving user problems.

---

# UX RULES

Prioritize:

- Fast workflows
- Minimal clicks
- Clear navigation
- Predictability
- Accessibility

Follow:

- Nielsen Heuristics
- Material Design 3
- WCAG 2.2

Every workflow should feel intuitive.

---

# UI DESIGN RULES

Prioritize:

- Visual Hierarchy
- Clear Typography
- Consistent Colors
- Consistent Spacing
- Consistent Components

Avoid:

- Cluttered Interfaces
- Inconsistent Layouts
- Excessive Modals

---

# DESIGN SYSTEM RULES

Create and maintain:

- Design Tokens
- Color System
- Typography System
- Spacing System
- Elevation System
- Breakpoints
- Motion System

All platforms must follow one unified design system.

---

# RESPONSIVE DESIGN RULES

Support:

- Mobile
- Tablet
- Desktop
- Ultra-wide

Never hardcode dimensions.

Use breakpoints.

Required support:

- 320px
- 768px
- 1024px
- 1440px+

---

# ACCESSIBILITY RULES

Support:

- Keyboard Navigation
- Screen Readers
- Focus States
- Color Contrast
- WCAG AA Standards

Accessibility is mandatory.

---

# CLEAN ARCHITECTURE

Required:

Presentation
Application
Domain
Infrastructure

Dependency direction:

Outer Layer
→ Inner Layer

Never reverse dependencies.

---

# SOLID PRINCIPLES

Mandatory:

S - Single Responsibility

O - Open Closed

L - Liskov Substitution

I - Interface Segregation

D - Dependency Inversion

---

# DOMAIN DRIVEN DESIGN

Use business language.

Avoid technical naming.

Bad:

DataManager
HelperService
Processor

Good:

Project
Issue
Sprint
User
Organization

---

# FEATURE-FIRST ORGANIZATION

Structure:

features/

authentication/
dashboard/
projects/
users/
settings/
notifications/

Each feature:

presentation/
application/
domain/
data/

---

# FILE SIZE LIMITS

Widget:
200 lines

Screen:
300 lines

Component:
250 lines

Controller:
150 lines

Service:
300 lines

Repository:
250 lines

Handler:
200 lines

If exceeded:

Split immediately.

---

# FILE NAMING RULES

Use:

snake_case

Examples:

project_repository.dart

auth_service.ts

create_project_command.cs

Forbidden:

helper.dart
utils.dart
manager.dart
misc.dart
common.dart

File names must clearly describe purpose.

---

# FOLDER NAMING RULES

Use:

snake_case

Examples:

project_management

authentication

notification_center

Avoid:

ProjectManagement

projectManagement

---

# FLUTTER RULES

Use:

Riverpod
Freezed
Dio
GoRouter

Architecture:

presentation/
domain/
data/

Separate:

- UI
- State
- Business Logic
- Networking

Never mix concerns.

Widget Limits:

Maximum 200 lines.

---

# REACT RULES

Use:

TypeScript
Zustand
TanStack Query

Separate:

Components
Hooks
Stores
Services
API

No business logic in components.

---

# ASP.NET CORE RULES

Architecture:

API
Application
Domain
Infrastructure
Persistence

Required:

CQRS
MediatR
Repository Pattern
Unit Of Work

Business logic belongs in Application layer.

---

# DATABASE RULES

Use:

PostgreSQL

Required:

- Primary Keys
- Foreign Keys
- Indexes
- Constraints

Never:

SELECT *

Always select explicit columns.

---

# DATABASE NAMING

Tables:

users
projects
issues
roles

Indexes:

ix_users_email

ix_projects_status

Unique Constraints:

uq_users_email

Foreign Keys:

fk_projects_users

Views:

vw_project_statistics

Stored Procedures:

sp_create_project

---

# VARIABLE NAMING RULES

Bad:

data
item
temp
obj
result
value

Good:

currentUser

selectedProject

activeSprint

projectProgressPercentage

completedIssueCount

---

# BOOLEAN VARIABLES

Must begin with:

is
has
can
should
was

Examples:

isAuthenticated

hasPermission

canDeleteProject

shouldRefresh

---

# COLLECTION VARIABLES

Use plural names.

Correct:

users

projects

issues

notifications

Avoid:

userList

projectArray

issueCollection

---

# ID VARIABLES

Always end with:

Id

Examples:

userId

projectId

issueId

organizationId

---

# DATE VARIABLES

Examples:

createdAt

updatedAt

deletedAt

startDate

endDate

dueDate

lastLoginAt

---

# FUNCTION NAMING RULES

Functions start with verbs.

Examples:

createProject()

updateProject()

deleteProject()

archiveProject()

getUserById()

fetchProjects()

validateEmail()

assignUser()

---

# BOOLEAN FUNCTIONS

Return true or false only.

Examples:

isAuthenticated()

hasPermission()

canEditProject()

isOwner()

---

# CLASS NAMING RULES

Use nouns.

Examples:

Project

Issue

Sprint

Notification

User

Services:

ProjectService

Repositories:

ProjectRepository

---

# INTERFACE NAMING

C#:

IProjectRepository

IUserService

INotificationService

---

# DEPENDENCY INJECTION

Mandatory.

Never instantiate dependencies directly.

Forbidden:

new ProjectRepository()

Use constructor injection.

---

# ERROR HANDLING

Never swallow exceptions.

Forbidden:

catch (e) {}

Always:

- Log
- Categorize
- Return meaningful errors

Use custom exceptions:

ValidationException

NotFoundException

AuthenticationException

AuthorizationException

BusinessRuleException

---

# API DESIGN RULES

RESTful APIs only.

Examples:

GET /api/projects

GET /api/projects/{id}

POST /api/projects

PUT /api/projects/{id}

DELETE /api/projects/{id}

Forbidden:

/CreateProject

/DeleteIssue

/GetUsers

---

# DTO RULES

Never expose entities directly.

Flow:

Entity
↓
DTO
↓
API Response

---

# STANDARD RESPONSE FORMAT

Success:

{
  "success": true,
  "message": "Operation completed",
  "data": {}
}

Error:

{
  "success": false,
  "errorCode": "RESOURCE_NOT_FOUND",
  "message": "Resource not found"
}

---

# SECURITY RULES

Never hardcode:

- Passwords
- Tokens
- Secrets
- API Keys

Store in:

- Environment Variables
- Secret Managers

Implement:

JWT

Refresh Tokens

RBAC

Rate Limiting

Input Validation

Input Sanitization

---

# LOGGING RULES

Allowed:

Information

Warning

Error

Critical

Never log:

Passwords

Tokens

Secret Keys

Sensitive Personal Data

---

# PERFORMANCE RULES

Required:

Pagination

Caching

Lazy Loading

Query Optimization

Redis

Avoid:

N+1 Queries

Large Memory Allocations

Massive API Responses

---

# TESTING RULES

Minimum Coverage:

Service Layer: 90%

Repositories: 90%

Use Cases: 90%

Test:

Happy Path

Failure Path

Edge Cases

---

# DEVOPS RULES

Use:

Docker

Docker Compose

GitHub Actions

CI/CD

Monitoring

Health Checks

Structured Logging

Recommended:

OpenTelemetry

Prometheus

Grafana

---

# COMMENTS POLICY

Code explains HOW.

Comments explain WHY.

Bad:

// Increase counter
counter++;

Good:

// Retry access token because external provider
// may invalidate tokens before expiration.
await refreshAccessToken();

---

# REFACTORING POLICY

Whenever modifying code:

Identify:

- Duplicate code
- Large files
- Tight coupling
- Dead code
- Unused dependencies
- Poor naming

Refactor when safe.

---

# TECHNICAL DEBT POLICY

Always report:

- Duplicated Logic
- God Classes
- Overly Large Components
- Architecture Violations
- Security Risks

---

# CODE REVIEW CHECKLIST

Before delivering code review:

Architecture

Security

Performance

Scalability

Maintainability

Testability

Accessibility

Naming Consistency

---

# GIT RULES

Branches:

feature/project-management

feature/user-authentication

bugfix/login-validation

hotfix/token-expiration

release/v1.0.0

---

# COMMIT MESSAGE RULES

feat: add sprint creation

fix: resolve login validation

refactor: extract issue service

docs: update api guide

test: add repository tests

---

# AI REVIEW MODE

Before implementation provide:

Architecture Score: XX/100

Security Score: XX/100

Performance Score: XX/100

Maintainability Score: XX/100

Testability Score: XX/100

List:

- Risks
- Weaknesses
- Suggested Improvements

Then implement.

---

# FINAL GOLDEN RULE

If a future developer cannot understand:

- File
- Folder
- Class
- Function
- Variable

Within 10 seconds,

Rename it.

Clarity is always more important than cleverness.

Maintainability is always more important than short code.

Long-term quality is always more important than speed.
