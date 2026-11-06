import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

/**
 * HYPREP FOI Management System — Convex schema.
 *
 * Maps 1:1 to the frontend domain contract in `src/types/index.ts` (camelCase
 * fields and enums) so the frontend adapter remains type-safe. The Better Auth component
 * owns its own tables (user, session, account, verification, twoFactor, ...);
 * this schema declares the application's business tables. App `users` rows link
 * to the Better Auth `user` document via the `authUserId` field.
 *
 * ToR §27 (Data Model) — User, Role, Case, Document, Note/Activity, CourtDate,
 * AuditLog, Report — plus the supporting reference and operational tables.
 */

/* ------------------------------------------------------------------ *
 * Users, roles & organisation reference
 * ------------------------------------------------------------------ */

export const userStatus = v.union(
  v.literal("active"),
  v.literal("invited"),
  v.literal("suspended"),
  v.literal("locked"),
);

export const roleId = v.union(
  v.literal("super_admin"),
  v.literal("admin"),
  v.literal("legal"),
  v.literal("clerk"),
  v.literal("requestor"),
  v.literal("auditor"),
  v.literal("external"),
);

export default defineSchema({
  /** App profile row. Links to Better Auth `user` via authUserId. */
  users: defineTable({
    authUserId: v.string(),
    name: v.string(),
    email: v.string(),
    roleId,
    phone: v.optional(v.string()),
    organization: v.string(),
    position: v.optional(v.string()),
    department: v.optional(v.string()),
    teamId: v.optional(v.string()),
    status: userStatus,
    avatarColor: v.string(),
    initials: v.string(),
    mfaEnabled: v.boolean(),
    failedLoginAttempts: v.optional(v.number()),
    mfaRequired: v.optional(v.boolean()),
    passwordChangedAt: v.optional(v.string()),
    invitationStatus: v.optional(v.union(v.literal("pending"), v.literal("sent"), v.literal("failed"), v.literal("blocked"))),
    lastLoginAt: v.optional(v.string()),
    createdAt: v.string(),
    updatedAt: v.string(),
  })
    .index("by_auth_user", ["authUserId"])
    .index("by_email", ["email"])
    .index("by_role", ["roleId"])
    .index("by_status", ["status"])
    .searchIndex("search_users", {
      searchField: "email",
      filterFields: ["status", "roleId"],
    }),

  roles: defineTable({
    name: v.string(),
    description: v.string(),
    permissions: v.array(v.string()),
    isSystem: v.boolean(),
  }),

  userSessions: defineTable({
    authSessionId: v.string(),
    authUserId: v.string(),
    lastSeenAt: v.number(),
    secondFactorVerifiedAt: v.optional(v.number()),
    secondFactorAttempts: v.optional(v.number()),
  }).index("by_session", ["authSessionId"]).index("by_last_seen", ["lastSeenAt"]),

  invitations: defineTable({
    userId: v.id("users"),
    token: v.string(),
    expiresAt: v.number(),
    attempts: v.number(),
    status: v.union(v.literal("pending"), v.literal("sending"), v.literal("sent"), v.literal("failed"), v.literal("blocked")),
    leaseUntil: v.optional(v.number()),
    error: v.optional(v.string()),
  }).index("by_user", ["userId"]),

  requestors: defineTable({
    userId: v.optional(v.id("users")),
    name: v.string(),
    email: v.string(),
    phone: v.optional(v.string()),
    organization: v.optional(v.string()),
    isJournalist: v.boolean(),
  })
    .index("by_user", ["userId"])
    .index("by_email", ["email"]),

  departments: defineTable({
    name: v.string(),
    code: v.string(),
    headUserId: v.optional(v.id("users")),
    caseCount: v.number(),
  }),

  courts: defineTable({
    name: v.string(),
    division: v.string(),
    state: v.string(),
    address: v.string(),
  }),

  legalTeams: defineTable({
    name: v.string(),
    leadUserId: v.optional(v.id("users")),
    memberIds: v.array(v.id("users")),
    focus: v.string(),
  }),

  taxonomyTerms: defineTable({
    label: v.string(),
    kind: v.union(
      v.literal("tag"),
      v.literal("category"),
      v.literal("outcome_code"),
      v.literal("closure_reason"),
      v.literal("retention_label"),
    ),
    description: v.optional(v.string()),
    color: v.optional(v.string()),
    usageCount: v.number(),
  })
    .index("by_kind", ["kind"]),

  organizations: defineTable({
    name: v.string(),
    code: v.string(),
    status: v.union(v.literal("active"), v.literal("inactive")),
    createdAt: v.string(),
  }),

  /* ------------------------------------------------------------------ *
   * Cases (FOI requests)
   * ------------------------------------------------------------------ */

  cases: defineTable({
    caseNumber: v.string(),
    requestorId: v.id("requestors"),
    // Direct link to the signed-in profile for requestor row-level access.
    requestorUserId: v.optional(v.id("users")),
    requestor: v.object({
      name: v.string(),
      email: v.string(),
      phone: v.optional(v.string()),
      organization: v.optional(v.string()),
      isJournalist: v.boolean(),
    }),
    subject: v.string(),
    description: v.string(),
    assignedTo: v.optional(v.id("users")),
    assignedTeamId: v.optional(v.string()),
    status: v.union(
      v.literal("filed"),
      v.literal("in_review"),
      v.literal("pending_info"),
      v.literal("responded"),
      v.literal("escalated"),
      v.literal("appeal"),
      v.literal("closed"),
      v.literal("rejected"),
    ),
    priority: v.union(v.literal("low"), v.literal("medium"), v.literal("high"), v.literal("critical")),
    confidentiality: v.union(
      v.literal("public"),
      v.literal("internal"),
      v.literal("confidential"),
      v.literal("restricted"),
    ),
    responseFormat: v.union(
      v.literal("electronic"),
      v.literal("hard_copy"),
      v.literal("inspection"),
      v.literal("certified_copy"),
    ),
    source: v.union(
      v.literal("portal"),
      v.literal("email"),
      v.literal("walk_in"),
      v.literal("post"),
      v.literal("csv_import"),
      v.literal("api"),
    ),
    tags: v.array(v.string()),
    department: v.string(),
    dateSubmitted: v.string(),
    statutoryDueDate: v.string(),
    dateClosed: v.optional(v.string()),
    closureReason: v.optional(v.string()),
    outcomeCode: v.optional(v.string()),
    linkedCaseIds: v.array(v.id("cases")),
    isAppeal: v.boolean(),
    appealOfCaseId: v.optional(v.id("cases")),
    respondedAt: v.optional(v.string()),
    documentCount: v.number(),
    noteCount: v.number(),
    courtDateCount: v.number(),
    slaState: v.optional(
      v.union(
        v.literal("on_track"),
        v.literal("due_soon"),
        v.literal("overdue"),
        v.literal("met"),
        v.literal("breached"),
        v.literal("not_applicable"),
      ),
    ),
    createdAt: v.string(),
    updatedAt: v.string(),
  })
    .index("by_status", ["status"])
    .index("by_assignee", ["assignedTo"])
    .index("by_requestor", ["requestorId"])
    .index("by_department", ["department"])
    .index("by_date_submitted", ["dateSubmitted"])
    .index("by_due_date", ["statutoryDueDate"])
    .index("by_priority", ["priority"])
    .index("by_case_number", ["caseNumber"])
    .index("by_sla_state", ["slaState"])
    .index("by_date_submitted_and_status", ["dateSubmitted", "status"])
    .searchIndex("search_cases", {
      searchField: "subject",
      filterFields: ["status", "department", "priority", "confidentiality"],
    }),

  /* ------------------------------------------------------------------ *
   * Documents & versioning
   * ------------------------------------------------------------------ */

  documents: defineTable({
    caseId: v.id("cases"),
    fileName: v.string(),
    fileType: v.string(),
    fileSize: v.number(),
    storageId: v.id("_storage"),
    uploadedBy: v.id("users"),
    isPublic: v.boolean(),
    version: v.number(),
    checksum: v.string(),
    kind: v.union(
      v.literal("request"),
      v.literal("response"),
      v.literal("evidence"),
      v.literal("court_filing"),
      v.literal("correspondence"),
      v.literal("internal_memo"),
    ),
    confidentiality: v.union(
      v.literal("public"),
      v.literal("internal"),
      v.literal("confidential"),
      v.literal("restricted"),
    ),
    isRedacted: v.boolean(),
    redactionVerified: v.optional(v.boolean()),
    redactionCount: v.number(),
    virusScan: v.union(v.literal("pending"), v.literal("clean"), v.literal("infected"), v.literal("skipped")),
    ocr: v.union(
      v.literal("not_required"),
      v.literal("queued"),
      v.literal("processing"),
      v.literal("complete"),
      v.literal("failed"),
    ),
    retentionLabel: v.string(),
    retainUntil: v.string(),
    retentionReviewAt: v.optional(v.string()),
    legalHold: v.optional(v.boolean()),
    text: v.optional(v.string()),
    embedding: v.optional(v.array(v.float64())),
    createdAt: v.string(),
    updatedAt: v.optional(v.string()),
  })
    .index("by_case", ["caseId"])
    .index("by_kind", ["kind"])
    .index("by_retention", ["retainUntil"])
    .index("by_virus_scan", ["virusScan"])
    .index("by_uploaded_by", ["uploadedBy"])
    .searchIndex("search_documents", {
      searchField: "fileName",
      filterFields: ["kind", "confidentiality", "virusScan"],
    })
    .vectorIndex("by_document_text", {
      vectorField: "embedding",
      dimensions: 1536,
      filterFields: ["confidentiality"],
    }),

  documentVersions: defineTable({
    documentId: v.id("documents"),
    version: v.number(),
    uploadedBy: v.id("users"),
    createdAt: v.string(),
    fileSize: v.number(),
    checksum: v.string(),
    changeNote: v.optional(v.string()),
    storageId: v.optional(v.id("_storage")),
    virusScan: v.optional(v.union(v.literal("pending"), v.literal("clean"), v.literal("infected"), v.literal("skipped"))),
  })
    .index("by_document", ["documentId"]),

  /* ------------------------------------------------------------------ *
   * Notes, tasks, timeline
   * ------------------------------------------------------------------ */

  notes: defineTable({
    caseId: v.id("cases"),
    userId: v.id("users"),
    type: v.union(v.literal("internal"), v.literal("public")),
    content: v.string(),
    mentions: v.array(v.id("users")),
    attachmentIds: v.array(v.id("documents")),
    isPinned: v.boolean(),
    createdAt: v.string(),
  })
    .index("by_case", ["caseId"])
    .index("by_user", ["userId"])
    .searchIndex("search_notes", {
      searchField: "content",
      filterFields: ["type"],
    }),

  tasks: defineTable({
    caseId: v.id("cases"),
    title: v.string(),
    assigneeId: v.id("users"),
    dueDate: v.string(),
    status: v.union(v.literal("open"), v.literal("in_progress"), v.literal("done"), v.literal("blocked")),
    createdBy: v.id("users"),
    createdAt: v.string(),
  })
    .index("by_case", ["caseId"])
    .index("by_assignee", ["assigneeId"])
    .index("by_due_date", ["dueDate"]),

  timeline: defineTable({
    caseId: v.id("cases"),
    kind: v.union(
      v.literal("created"),
      v.literal("acknowledged"),
      v.literal("assigned"),
      v.literal("status_changed"),
      v.literal("note_added"),
      v.literal("document_uploaded"),
      v.literal("document_published"),
      v.literal("document_redacted"),
      v.literal("court_scheduled"),
      v.literal("court_outcome"),
      v.literal("linked"),
      v.literal("escalated"),
      v.literal("appeal_filed"),
      v.literal("closed"),
      v.literal("reopened"),
      v.literal("sla_warning"),
      v.literal("sla_breach"),
    ),
    actorId: v.optional(v.id("users")),
    at: v.string(),
    summary: v.string(),
    detail: v.optional(v.string()),
  })
    .index("by_case", ["caseId"])
    .index("by_at", ["at"]),

  /* ------------------------------------------------------------------ *
   * Court diary
   * ------------------------------------------------------------------ */

  courtDates: defineTable({
    caseId: v.id("cases"),
    suitNumber: v.string(),
    date: v.string(),
    time: v.string(),
    durationMinutes: v.number(),
    courtId: v.optional(v.id("courts")),
    courtName: v.string(),
    location: v.string(),
    judge: v.string(),
    hearingType: v.union(
      v.literal("mention"),
      v.literal("motion"),
      v.literal("hearing"),
      v.literal("judgment"),
      v.literal("adoption_of_address"),
      v.literal("pre_trial"),
    ),
    status: v.union(v.literal("scheduled"), v.literal("held"), v.literal("adjourned"), v.literal("cancelled")),
    counselIds: v.array(v.id("users")),
    notes: v.string(),
    outcome: v.optional(v.string()),
    nextActionDue: v.optional(v.string()),
    reminderLeadDays: v.array(v.number()),
    createdBy: v.id("users"),
    createdAt: v.string(),
  })
    .index("by_date", ["date"])
    .index("by_case", ["caseId"])
    .index("by_status", ["status"])
    .searchIndex("search_court", {
      searchField: "suitNumber",
      filterFields: ["status"],
    }),

  /* ------------------------------------------------------------------ *
   * Notifications
   * ------------------------------------------------------------------ */

  notifications: defineTable({
    userId: v.id("users"),
    kind: v.union(
      v.literal("case_assigned"),
      v.literal("status_changed"),
      v.literal("response_uploaded"),
      v.literal("due_soon"),
      v.literal("overdue"),
      v.literal("court_reminder"),
      v.literal("mention"),
      v.literal("task_assigned"),
      v.literal("admin_alert"),
      v.literal("appeal_filed"),
    ),
    title: v.string(),
    body: v.string(),
    link: v.string(),
    at: v.string(),
    isRead: v.boolean(),
    channels: v.array(v.union(v.literal("in_app"), v.literal("email"), v.literal("sms"))),
  })
    .index("by_user", ["userId"])
    .index("by_user_read", ["userId", "isRead"])
    .index("by_at", ["at"]),

  notificationPreferences: defineTable({
    userId: v.id("users"),
    kind: v.union(
      v.literal("case_assigned"),
      v.literal("status_changed"),
      v.literal("response_uploaded"),
      v.literal("due_soon"),
      v.literal("overdue"),
      v.literal("court_reminder"),
      v.literal("mention"),
      v.literal("task_assigned"),
      v.literal("admin_alert"),
      v.literal("appeal_filed"),
    ),
    label: v.string(),
    description: v.string(),
    inApp: v.boolean(),
    email: v.boolean(),
    sms: v.boolean(),
  })
    .index("by_user", ["userId"])
    .index("by_user_kind", ["userId", "kind"]),

  notificationDeliveries: defineTable({
    notificationId: v.id("notifications"),
    channel: v.union(v.literal("email"), v.literal("sms")),
    status: v.union(v.literal("pending"), v.literal("sending"), v.literal("sent"), v.literal("failed"), v.literal("blocked")),
    attempts: v.number(),
    nextAttemptAt: v.number(),
    leaseUntil: v.optional(v.number()),
    providerId: v.optional(v.string()),
    error: v.optional(v.string()),
    sentAt: v.optional(v.string()),
  }).index("by_status_due", ["status", "nextAttemptAt"]),

  /* ------------------------------------------------------------------ *
   * Audit & access logs (append-only)
   * ------------------------------------------------------------------ */

  auditLogs: defineTable({
    entityType: v.string(),
    entityId: v.string(),
    entityLabel: v.string(),
    action: v.union(
      v.literal("create"),
      v.literal("update"),
      v.literal("delete"),
      v.literal("login"),
      v.literal("login_failed"),
      v.literal("logout"),
      v.literal("export"),
      v.literal("permission_change"),
      v.literal("download"),
      v.literal("view"),
      v.literal("publish"),
      v.literal("redact"),
      v.literal("settings_change"),
    ),
    // Automated jobs and inbound integrations are first-class audit actors.
    // Keep this required so every entry remains attributable.
    performedBy: v.union(v.id("users"), v.literal("system")),
    timestamp: v.string(),
    details: v.string(),
    ipAddress: v.string(),
    userAgent: v.string(),
    severity: v.union(v.literal("info"), v.literal("notice"), v.literal("warning"), v.literal("critical")),
    prevHash: v.optional(v.string()),
  })
    .index("by_entity", ["entityType", "entityId"])
    .index("by_timestamp", ["timestamp"])
    .index("by_actor", ["performedBy"])
    .index("by_action", ["action"]),

  accessLogs: defineTable({
    documentId: v.id("documents"),
    documentName: v.string(),
    caseId: v.id("cases"),
    caseNumber: v.string(),
    userId: v.id("users"),
    action: v.union(v.literal("view"), v.literal("download"), v.literal("print"), v.literal("denied")),
    at: v.string(),
    ipAddress: v.string(),
  })
    .index("by_document", ["documentId"])
    .index("by_user", ["userId"])
    .index("by_at", ["at"]),

  /* ------------------------------------------------------------------ *
   * Templates, reports, views
   * ------------------------------------------------------------------ */

  templates: defineTable({
    name: v.string(),
    category: v.union(
      v.literal("acknowledgement"),
      v.literal("response"),
      v.literal("refusal"),
      v.literal("notice"),
      v.literal("affidavit"),
      v.literal("internal"),
    ),
    description: v.string(),
    body: v.string(),
    mergeFields: v.array(v.string()),
    updatedBy: v.id("users"),
    updatedAt: v.string(),
    usageCount: v.number(),
  }),

  reports: defineTable({
    name: v.string(),
    description: v.string(),
    creatorId: v.id("users"),
    filters: v.object({
      period: v.union(
        v.literal("weekly"),
        v.literal("monthly"),
        v.literal("quarterly"),
        v.literal("yearly"),
        v.literal("custom"),
      ),
      dateFrom: v.optional(v.string()),
      dateTo: v.optional(v.string()),
      statuses: v.array(v.string()),
      departments: v.array(v.string()),
      priorities: v.array(v.string()),
      assignees: v.array(v.string()),
      tags: v.array(v.string()),
      groupBy: v.union(
        v.literal("status"),
        v.literal("department"),
        v.literal("assignee"),
        v.literal("priority"),
        v.literal("month"),
        v.literal("requestor"),
      ),
      metrics: v.array(
        v.union(
          v.literal("count"),
          v.literal("avg_response_days"),
          v.literal("sla_compliance"),
          v.literal("overdue_count"),
          v.literal("appeals"),
          v.literal("escalations"),
        ),
      ),
    }),
    cadence: v.union(v.literal("none"), v.literal("weekly"), v.literal("monthly"), v.literal("quarterly"), v.literal("yearly")),
    recipients: v.array(v.string()),
    format: v.union(v.literal("csv"), v.literal("pdf"), v.literal("xlsx")),
    lastRun: v.optional(v.string()),
    nextRun: v.optional(v.string()),
    createdAt: v.string(),
  }).index("by_creator", ["creatorId"]).index("by_next_run", ["nextRun"]),

  reportRuns: defineTable({
    reportId: v.id("reports"),
    startedAt: v.string(),
    finishedAt: v.optional(v.string()),
    status: v.union(v.literal("running"), v.literal("success"), v.literal("failed")),
    storageId: v.optional(v.id("_storage")),
    error: v.optional(v.string()),
    attempts: v.optional(v.number()),
    leaseUntil: v.optional(v.number()),
  }).index("by_report", ["reportId"]),

  views: defineTable({
    name: v.string(),
    ownerId: v.id("users"),
    isShared: v.boolean(),
    filters: v.any(),
    createdAt: v.string(),
  })
    .index("by_owner", ["ownerId"]),

  /* ------------------------------------------------------------------ *
   * System settings, integrations, operations
   * ------------------------------------------------------------------ */

  systemSettings: defineTable({
    organizationName: v.string(),
    statutoryResponseDays: v.number(),
    slaWarningThresholdDays: v.number(),
    selfRegistrationEnabled: v.boolean(),
    mfaRequiredForPrivileged: v.boolean(),
    sessionTimeoutMinutes: v.number(),
    passwordMinLength: v.number(),
    passwordRotationDays: v.number(),
    lockoutAttempts: v.number(),
    maxUploadSizeMb: v.number(),
    allowedFileTypes: v.array(v.string()),
    virusScanEnabled: v.boolean(),
    ocrEnabled: v.boolean(),
    defaultRetentionYears: v.number(),
    timezone: v.string(),
    ssoEnabled: v.boolean(),
    ssoProvider: v.union(v.literal("saml"), v.literal("oauth2"), v.literal("none")),
  }),

  webhooks: defineTable({
    url: v.string(),
    events: v.array(v.string()),
    isActive: v.boolean(),
    secretMasked: v.string(),
    lastDeliveryAt: v.optional(v.string()),
    lastStatus: v.optional(v.number()),
    createdAt: v.string(),
  }),

  apiClients: defineTable({
    name: v.string(),
    clientId: v.string(),
    secretHash: v.string(),
    scopes: v.array(v.string()),
    createdAt: v.string(),
    lastUsedAt: v.optional(v.string()),
    isActive: v.boolean(),
  })
    .index("by_client_id", ["clientId"]),

  fileTickets: defineTable({
    token: v.string(),
    storageId: v.id("_storage"),
    userId: v.id("users"),
    authSessionId: v.string(),
    permission: v.union(v.literal("system:backup"), v.literal("system:export"), v.literal("report:export"), v.literal("document:read"), v.literal("document:download")),
    documentId: v.optional(v.id("documents")),
    version: v.optional(v.number()),
    inline: v.optional(v.boolean()),
    filename: v.string(),
    expiresAt: v.number(),
  }).index("by_token", ["token"]),

  backups: defineTable({
    startedAt: v.string(),
    type: v.union(v.literal("full"), v.literal("incremental")),
    sizeMb: v.number(),
    status: v.union(v.literal("success"), v.literal("running"), v.literal("failed")),
    target: v.string(),
    restoreTested: v.boolean(),
    storageId: v.optional(v.id('_storage')),
    checksum: v.optional(v.string()),
    completedAt: v.optional(v.string()),
    error: v.optional(v.string()),
  }),

  importBatches: defineTable({
    createdBy: v.id("users"),
    fileName: v.string(),
    totalRows: v.number(),
    created: v.number(),
    skipped: v.number(),
    status: v.union(v.literal("running"), v.literal("success"), v.literal("failed")),
    errorRows: v.array(v.string()),
    caseNumbers: v.array(v.string()),
    createdAt: v.string(),
  }),

  serviceHealth: defineTable({
    name: v.string(),
    status: v.union(v.literal("operational"), v.literal("degraded"), v.literal("down")),
    latencyMs: v.number(),
    detail: v.string(),
    checkedAt: v.string(),
  }),

  counters: defineTable({
    key: v.string(),
    value: v.number(),
  }).index("by_key", ["key"]),

  maintenanceCursors: defineTable({
    job: v.string(),
    cursor: v.union(v.string(), v.null()),
  }).index("by_job", ["job"]),
});
