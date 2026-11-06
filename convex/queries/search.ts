/**
 * Global search (FR-040, ToR §15). Searches case number/subject/requestor,
 * file names, note content, suit numbers, and users — always scoped to the
 * caller's row-level visibility. Returns the live search-hit shape consumed by
 * the frontend adapter.
 */

import { query } from "../_generated/server";
import { v } from "convex/values";
import { requireUser } from "../lib/session";
import { visibleCases, hasPermission } from "../lib/permissions";
import { canReadDocument } from "../lib/documentAccess";

export const globalSearch = query({
  args: {
    term: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const needle = args.term.trim().toLowerCase();
    if (needle.length < 2) return [];
    const limit = Math.min(args.limit ?? 40, 100);

    const hits: Array<{
      id: string;
      type: string;
      title: string;
      subtitle: string;
      snippet: string;
      link: string;
      matchedOn: string;
    }> = [];

    const cases = await ctx.db.query("cases").withIndex("by_date_submitted").take(3000) as never;
    const scoped = visibleCases(
      user.roleId,
      user._id,
      cases,
      [],
      user.teamId,
    ) as unknown as Array<{
      _id: string;
      caseNumber: string;
      subject: string;
      description: string;
      requestor: { name: string; organization?: string | null };
      department: string;
      tags: string[];
    }>;
    const caseIds = new Set(scoped.map((c) => c._id));
    const isRequestor = user.roleId === "requestor" || user.roleId === "external";
    const base = isRequestor ? "/my-requests" : "/cases";

    for (const c of scoped) {
      const matchedOn =
        c.caseNumber.toLowerCase().includes(needle)
          ? "Case number"
          : c.subject.toLowerCase().includes(needle)
            ? "Subject"
            : c.requestor.name.toLowerCase().includes(needle) ||
                (c.requestor.organization ?? "").toLowerCase().includes(needle)
              ? "Requestor"
              : c.description.toLowerCase().includes(needle)
                ? "Request body"
                : c.tags.some((t) => t.toLowerCase().includes(needle))
                  ? "Tag"
                  : "";
      if (!matchedOn) continue;
      hits.push({
        id: c._id,
        type: "case",
        title: `${c.caseNumber} — ${c.subject}`,
        subtitle: `${c.requestor.organization ?? "Individual requestor"} · ${c.department}`,
        snippet: c.description.slice(0, 180),
        link: `${base}/${c._id}`,
        matchedOn,
      });
    }

    // Documents (scoped by case visibility).
    const docs = await ctx.db.query("documents").withIndex("by_kind").take(2000);
    const docByCase = new Map(docs.filter((document) => caseIds.has(document.caseId) && canReadDocument(user, document)).map((document) => [document._id, document]));
    for (const d of docByCase.values()) {
      const inName = d.fileName.toLowerCase().includes(needle);
      // OCR-extracted text makes scanned documents searchable (FR-040).
      const inText = !inName && (d.text ?? "").toLowerCase().includes(needle);
      if (!inName && !inText) continue;
      hits.push({
        id: d._id,
        type: "document",
        title: d.fileName,
        subtitle: `version ${d.version}`,
        snippet: `${d.kind.replace("_", " ")} · ${d.isRedacted ? `${d.redactionCount} redactions` : "no redactions"}`,
        link: `${base}/${d.caseId}?tab=documents`,
        matchedOn: inName ? "File name" : "Document text",
      });
    }

    // Notes (scoped, internal filtered for requestors/externals).
    if (!isRequestor) {
      const notes = await ctx.db.query("notes").withIndex("by_user").take(2000);
      for (const n of notes) {
        if (!caseIds.has(n.caseId)) continue;
        if (n.type === "internal" && user.roleId === "external") continue;
        if (!n.content.toLowerCase().includes(needle)) continue;
        hits.push({
          id: n._id,
          type: "note",
          title: n.type === "internal" ? "Internal note" : "Note to requestor",
          subtitle: "case note",
          snippet: n.content.slice(0, 180),
          link: `${base}/${n.caseId}?tab=notes`,
          matchedOn: "Note content",
        });
      }
    }

    // Court dates (scoped).
    if (!isRequestor) {
      const courtDates = await ctx.db.query("courtDates").withIndex("by_date").take(2000);
      for (const cd of courtDates) {
        if (!caseIds.has(cd.caseId)) continue;
        const haystack = `${cd.suitNumber} ${cd.courtName} ${cd.judge}`.toLowerCase();
        if (!haystack.includes(needle)) continue;
        hits.push({
          id: cd._id,
          type: "court_date",
          title: `${cd.suitNumber} — ${cd.hearingType.replace(/_/g, " ")}`,
          subtitle: `${cd.courtName} · ${cd.date} at ${cd.time}`,
          snippet: cd.outcome ?? cd.notes,
          link: `/court?date=${cd.date}`,
          matchedOn: "Suit number",
        });
      }
    }

    // Users (staff only).
    if (!isRequestor && hasPermission(user.roleId, "user:read")) {
      const users = await ctx.db.query("users").withIndex("by_status").take(1000);
      for (const u of users) {
        const haystack = `${u.name} ${u.email} ${u.organization} ${u.position ?? ""}`.toLowerCase();
        if (!haystack.includes(needle)) continue;
        hits.push({
          id: u._id,
          type: "user",
          title: u.name,
          subtitle: `${u.position ?? u.organization} · ${u.email}`,
          snippet: `Role: ${u.roleId.replace("_", " ")} · status ${u.status}`,
          link: `/admin/users?focus=${u._id}`,
          matchedOn: "Name or email",
        });
      }
    }

    return hits.slice(0, limit);
  },
});
