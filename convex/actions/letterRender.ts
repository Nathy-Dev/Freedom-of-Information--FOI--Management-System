"use node";

/**
 * Letter generation (FR-033): merges a template body against case data and
 * returns the rendered letter (optionally stored/uploaded as a document).
 */

import { action } from "../_generated/server";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import { getCurrentIdentity } from "../lib/session";

export const render = action({
  args: {
    templateId: v.id("templates"),
    caseId: v.id("cases"),
  },
  handler: async (ctx, args) => {
    const identity = await getCurrentIdentity(ctx);
    if (!identity) throw new Error("Unauthenticated");

    const data = (await ctx.runQuery(internal.internal.letterRenderDb.getRenderData, {
      templateId: args.templateId,
      caseId: args.caseId,
      actorAuthUserId: identity.subject,
    })) as {
      authorized: boolean;
      body: string;
      templateName: string;
      caseNumber: string;
      requestorName: string;
      requestorOrganization: string;
      requestorEmail: string;
      subject: string;
      dateSubmitted: string;
      statutoryDueDate: string;
      department: string;
      actorName: string;
      actorPosition: string | null;
      suitNumber: string | null;
      courtName: string | null;
      hearingDate: string | null;
    } | null;
    if (!data) throw new Error("Template or case not found, or not visible.");
    if (!data.authorized) throw new Error("Forbidden.");

    const values: Record<string, string> = {
      "{{case_number}}": data.caseNumber,
      "{{requestor_name}}": data.requestorName,
      "{{requestor_organization}}": data.requestorOrganization,
      "{{requestor_email}}": data.requestorEmail,
      "{{subject}}": data.subject,
      "{{date_submitted}}": data.dateSubmitted,
      "{{statutory_due_date}}": data.statutoryDueDate,
      "{{today}}": new Date().toISOString().slice(0, 10),
      "{{officer_name}}": data.actorName,
      "{{officer_position}}": data.actorPosition ?? "Legal Officer",
      "{{department}}": data.department,
      "{{exemption_grounds}}": "[Set out each ground relied upon, citing the relevant section of the Act]",
      "{{records_released}}": "[List the records released]",
      "{{records_withheld}}": "[List the information severed]",
      "{{fee_amount}}": "Nil",
      "{{suit_number}}": data.suitNumber ?? "[Suit number]",
      "{{court_name}}": data.courtName ?? "[Court]",
      "{{hearing_date}}": data.hearingDate ?? "[Hearing date]",
    };

    let body = data.body;
    for (const [token, value] of Object.entries(values)) {
      body = body.split(token).join(value);
    }

    // Increment usage count.
    await ctx.runMutation(internal.internal.letterRenderDb.bumpUsage, {
      templateId: args.templateId,
    });

    return { body, name: data.templateName };
  },
});
