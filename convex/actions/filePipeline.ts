"use node";

/**
 * File pipeline action (ToR §12/§20): checksum + virus scan + OCR via Google
 * Cloud Vision (user-resolved choice). Runs in the Node runtime; DB work is
 * delegated to internal query/mutation in `convex/internal/filePipelineDb.ts`.
 * Reads typed env vars from the generated `env` export.
 */

import { internalAction, env } from "../_generated/server";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import { createHash } from "node:crypto";

/** Image file types Google Cloud Vision can OCR. */
const OCR_IMAGE_TYPES = new Set(["png", "jpg", "jpeg", "webp", "gif", "tif", "tiff", "bmp"]);

/** Resolve whether a document needs OCR and which Vision kind applies. */
function resolveOcrKind(
  fileType: string,
  fileName: string,
): { kind: "pdf" | string } | null {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  if (fileType === "pdf" || ext === "pdf") return { kind: "pdf" };
  if (OCR_IMAGE_TYPES.has(fileType)) return { kind: fileType };
  if (OCR_IMAGE_TYPES.has(ext)) return { kind: ext };
  return null;
}

/** Process a newly uploaded document: checksum → virus scan → OCR. */
export const process = internalAction({
  args: { documentId: v.id("documents"), attempt: v.optional(v.number()) },
  returns: v.union(v.null(), v.object({ checksum: v.string(), virusScan: v.union(v.literal("pending"), v.literal("clean"), v.literal("infected"), v.literal("skipped")), ocr: v.union(v.literal("complete"), v.literal("not_required"), v.literal("failed")) })),
  handler: async (ctx, args) => {
    const doc = await ctx.runQuery(internal.internal.filePipelineDb.getDocument, {
      documentId: args.documentId,
    });
    if (!doc || !doc.url) return null;

    // 1. Checksum + 2. Virus scan.
    let checksum = "";
    let scanResult: "pending" | "clean" | "infected" | "skipped" = "pending";
    let buf: ArrayBuffer | null = null;
    try {
      const fileRes = await fetch(doc.url);
      if (!fileRes.ok) throw new Error("Stored file could not be read.");
      buf = await fileRes.arrayBuffer();
      checksum = createHash("sha256").update(new Uint8Array(buf)).digest("hex");

      const clamavUrl = env.CLAMAV_URL;
      if (!doc.virusScanEnabled) scanResult = "skipped";
      else {
        if (!clamavUrl) throw new Error("Virus scanner is not configured.");
        const scanRes = await fetch(`${clamavUrl.replace(/\/$/, "")}/scan`, { method: "POST", body: buf, signal: AbortSignal.timeout(60000) });
        if (!scanRes.ok) throw new Error("Virus scanner is unavailable.");
        const body = (await scanRes.json()) as { infected?: boolean };
        if (typeof body.infected !== "boolean") throw new Error("Virus scanner returned an invalid result.");
        scanResult = body.infected ? "infected" : "clean";
      }
    } catch (e) {
      console.error("[filePipeline] file remains quarantined", e instanceof Error ? e.message : "Scan failure");
    }

    // 3. OCR via Google Cloud Vision for PDFs/images.
    let ocrText: string | undefined;
    let ocrStatus: "complete" | "not_required" | "failed" = "not_required";
    const ocrKind = resolveOcrKind(doc.fileType, doc.fileName);
    const apiKey = env.OCR_API_KEY;
    const endpoint = env.OCR_ENDPOINT;
    if (ocrKind && doc.url && (scanResult === "clean" || scanResult === "skipped")) {
      if (apiKey && endpoint && doc.ocrEnabled) {
        try {
          // Reuse the already-downloaded bytes when available.
          const text = await runGoogleCloudVision(
            endpoint,
            apiKey,
            buf ?? doc.url,
            ocrKind.kind,
          );
          if (text) {
            ocrText = text;
            ocrStatus = "complete";
          } else {
            ocrStatus = "failed";
          }
        } catch (e) {
          console.error("[filePipeline] OCR error:", e);
          ocrStatus = "failed";
        }
      }
      // No credentials or OCR disabled in settings → stays "not_required"
      // so the document doesn't sit in "queued" forever.
    }

    // 4. Persist results.
    await ctx.runMutation(internal.internal.filePipelineDb.updateDocument, {
      documentId: args.documentId,
      storageId: doc.storageId,
      checksum,
      virusScan: scanResult,
      ocr: ocrStatus,
      text: ocrText,
    });

    if (scanResult === "pending" && (args.attempt ?? 0) < 4) {
      await ctx.scheduler.runAfter(60000 * 2 ** (args.attempt ?? 0), internal.actions.filePipeline.process, { documentId: args.documentId, attempt: (args.attempt ?? 0) + 1 });
    }
    return { checksum, virusScan: scanResult, ocr: ocrStatus };
  },
});

/**
 * Google Cloud Vision OCR. PDFs must use the `files:annotate` endpoint with
 * `inputConfig` (their responses nest one entry per page); images use
 * `images:annotate` with `image.content`. The configured endpoint is
 * normalized to the right variant automatically.
 */
async function runGoogleCloudVision(
  endpoint: string,
  apiKey: string,
  source: ArrayBuffer | string,
  fileType: string,
): Promise<string> {
  const buf =
    typeof source === "string"
      ? await (await fetch(source)).arrayBuffer()
      : source;
  const base64 = Buffer.from(buf).toString("base64");

  const isPdf = fileType === "pdf";
  const mimeType = isPdf
    ? "application/pdf"
    : `image/${fileType === "jpg" ? "jpeg" : fileType}`;

  const annotateUrl = isPdf
    ? endpoint.replace(/images:annotate$/, "files:annotate")
    : endpoint.replace(/files:annotate$/, "images:annotate");

  const payload = isPdf
    ? {
        requests: [
          {
            features: [{ type: "DOCUMENT_TEXT_DETECTION" }],
            inputConfig: { content: base64, mimeType },
          },
        ],
      }
    : {
        requests: [
          {
            features: [{ type: "DOCUMENT_TEXT_DETECTION" }],
            image: { content: base64 },
          },
        ],
      };

  const response = await fetch(`${annotateUrl}?key=${apiKey}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Google Cloud Vision error ${response.status}: ${(await response.text()).slice(0, 300)}`);
  }

  const body = (await response.json()) as {
    responses?: Array<{
      fullTextAnnotation?: { text?: string };
      responses?: Array<{ fullTextAnnotation?: { text?: string } }>;
    }>;
  };
  const first = body.responses?.[0];
  if (!first) return "";
  // files:annotate nests one response per page; images:annotate is flat.
  if (Array.isArray(first.responses)) {
    return first.responses
      .map((r) => r.fullTextAnnotation?.text ?? "")
      .join("\n\n")
      .trim();
  }
  return first.fullTextAnnotation?.text ?? "";
}
