export function entraTenant(environment: Record<string, string | undefined>): string | null {
  const tenant = environment.ENTRA_ID_TENANT_ID?.trim() || environment.ENTRA_ID_ISSUER_URL?.trim().match(/^https:\/\/login\.microsoftonline\.com\/([0-9a-f-]+)\/v2\.0\/?$/i)?.[1];
  return tenant && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tenant) ? tenant.toLowerCase() : null;
}

export function entraConfigured(environment: Record<string, string | undefined>): boolean {
  return !!(entraTenant(environment) && environment.ENTRA_ID_CLIENT_ID?.trim() && environment.ENTRA_ID_CLIENT_SECRET?.trim());
}
