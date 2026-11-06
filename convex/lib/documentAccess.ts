import type { Doc } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { forbiddenError } from "./session";

export function canReadDocument(user: Doc<"users">, document: Doc<"documents">): boolean {
  return user.roleId !== "requestor" || (document.isPublic && document.virusScan === "clean" && (!document.isRedacted || document.redactionVerified === true));
}

export async function documentForReader(_ctx: QueryCtx, user: Doc<"users">, document: Doc<"documents">) {
  if (!canReadDocument(user, document)) throw forbiddenError("This document has not been safely released to you.");
  const requestor = user.roleId === "requestor";
  return {
    ...document,
    storageId: null,
    text: requestor ? undefined : document.text,
    embedding: undefined,
    url: null,
  };
}
