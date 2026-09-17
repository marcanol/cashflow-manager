/** Keep post-auth redirects on this application origin. */
export function safeNextPath(value: string | null): string {
  return value?.startsWith("/") && !value.startsWith("//") ? value : "/";
}
