/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as accountActions from "../accountActions.js";
import type * as actions_backups from "../actions/backups.js";
import type * as actions_email from "../actions/email.js";
import type * as actions_export from "../actions/export.js";
import type * as actions_filePipeline from "../actions/filePipeline.js";
import type * as actions_letterRender from "../actions/letterRender.js";
import type * as actions_notifications from "../actions/notifications.js";
import type * as actions_reports from "../actions/reports.js";
import type * as actions_sms from "../actions/sms.js";
import type * as actions_webhooks from "../actions/webhooks.js";
import type * as auth from "../auth.js";
import type * as crons from "../crons.js";
import type * as fileAccess from "../fileAccess.js";
import type * as http from "../http.js";
import type * as http_rest from "../http/rest.js";
import type * as http_restApi from "../http/restApi.js";
import type * as http_webhookHandlers from "../http/webhookHandlers.js";
import type * as http_webhooks from "../http/webhooks.js";
import type * as internal_accountDb from "../internal/accountDb.js";
import type * as internal_backupDb from "../internal/backupDb.js";
import type * as internal_cronWorkers from "../internal/cronWorkers.js";
import type * as internal_exportDb from "../internal/exportDb.js";
import type * as internal_filePipelineDb from "../internal/filePipelineDb.js";
import type * as internal_letterRenderDb from "../internal/letterRenderDb.js";
import type * as internal_notificationDb from "../internal/notificationDb.js";
import type * as internal_reportDb from "../internal/reportDb.js";
import type * as internal_webhookDb from "../internal/webhookDb.js";
import type * as lib_audit from "../lib/audit.js";
import type * as lib_cases from "../lib/cases.js";
import type * as lib_constants from "../lib/constants.js";
import type * as lib_crypto from "../lib/crypto.js";
import type * as lib_documentAccess from "../lib/documentAccess.js";
import type * as lib_entraSettings from "../lib/entraSettings.js";
import type * as lib_ids from "../lib/ids.js";
import type * as lib_notifications from "../lib/notifications.js";
import type * as lib_permissions from "../lib/permissions.js";
import type * as lib_reportData from "../lib/reportData.js";
import type * as lib_reportFiles from "../lib/reportFiles.js";
import type * as lib_reportSchedule from "../lib/reportSchedule.js";
import type * as lib_session from "../lib/session.js";
import type * as lib_sla from "../lib/sla.js";
import type * as lib_validation from "../lib/validation.js";
import type * as mutations_admin from "../mutations/admin.js";
import type * as mutations_cases from "../mutations/cases.js";
import type * as mutations_court from "../mutations/court.js";
import type * as mutations_documents from "../mutations/documents.js";
import type * as mutations_import from "../mutations/import.js";
import type * as mutations_notes from "../mutations/notes.js";
import type * as mutations_notifications from "../mutations/notifications.js";
import type * as queries_admin from "../queries/admin.js";
import type * as queries_audit from "../queries/audit.js";
import type * as queries_auth from "../queries/auth.js";
import type * as queries_cases from "../queries/cases.js";
import type * as queries_court from "../queries/court.js";
import type * as queries_dashboard from "../queries/dashboard.js";
import type * as queries_documents from "../queries/documents.js";
import type * as queries_notifications from "../queries/notifications.js";
import type * as queries_reports from "../queries/reports.js";
import type * as queries_search from "../queries/search.js";
import type * as queries_templates from "../queries/templates.js";
import type * as scheduled from "../scheduled.js";
import type * as seed from "../seed.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  accountActions: typeof accountActions;
  "actions/backups": typeof actions_backups;
  "actions/email": typeof actions_email;
  "actions/export": typeof actions_export;
  "actions/filePipeline": typeof actions_filePipeline;
  "actions/letterRender": typeof actions_letterRender;
  "actions/notifications": typeof actions_notifications;
  "actions/reports": typeof actions_reports;
  "actions/sms": typeof actions_sms;
  "actions/webhooks": typeof actions_webhooks;
  auth: typeof auth;
  crons: typeof crons;
  fileAccess: typeof fileAccess;
  http: typeof http;
  "http/rest": typeof http_rest;
  "http/restApi": typeof http_restApi;
  "http/webhookHandlers": typeof http_webhookHandlers;
  "http/webhooks": typeof http_webhooks;
  "internal/accountDb": typeof internal_accountDb;
  "internal/backupDb": typeof internal_backupDb;
  "internal/cronWorkers": typeof internal_cronWorkers;
  "internal/exportDb": typeof internal_exportDb;
  "internal/filePipelineDb": typeof internal_filePipelineDb;
  "internal/letterRenderDb": typeof internal_letterRenderDb;
  "internal/notificationDb": typeof internal_notificationDb;
  "internal/reportDb": typeof internal_reportDb;
  "internal/webhookDb": typeof internal_webhookDb;
  "lib/audit": typeof lib_audit;
  "lib/cases": typeof lib_cases;
  "lib/constants": typeof lib_constants;
  "lib/crypto": typeof lib_crypto;
  "lib/documentAccess": typeof lib_documentAccess;
  "lib/entraSettings": typeof lib_entraSettings;
  "lib/ids": typeof lib_ids;
  "lib/notifications": typeof lib_notifications;
  "lib/permissions": typeof lib_permissions;
  "lib/reportData": typeof lib_reportData;
  "lib/reportFiles": typeof lib_reportFiles;
  "lib/reportSchedule": typeof lib_reportSchedule;
  "lib/session": typeof lib_session;
  "lib/sla": typeof lib_sla;
  "lib/validation": typeof lib_validation;
  "mutations/admin": typeof mutations_admin;
  "mutations/cases": typeof mutations_cases;
  "mutations/court": typeof mutations_court;
  "mutations/documents": typeof mutations_documents;
  "mutations/import": typeof mutations_import;
  "mutations/notes": typeof mutations_notes;
  "mutations/notifications": typeof mutations_notifications;
  "queries/admin": typeof queries_admin;
  "queries/audit": typeof queries_audit;
  "queries/auth": typeof queries_auth;
  "queries/cases": typeof queries_cases;
  "queries/court": typeof queries_court;
  "queries/dashboard": typeof queries_dashboard;
  "queries/documents": typeof queries_documents;
  "queries/notifications": typeof queries_notifications;
  "queries/reports": typeof queries_reports;
  "queries/search": typeof queries_search;
  "queries/templates": typeof queries_templates;
  scheduled: typeof scheduled;
  seed: typeof seed;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  betterAuth: import("@convex-dev/better-auth/_generated/component.js").ComponentApi<"betterAuth">;
};
