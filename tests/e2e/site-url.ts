/** Set the full repository URL to run the same checks against the published site. */
export const siteBaseURL = `${(process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:4173/suitor-protocol").replace(/\/+$/, "")}/`;

export function siteURL(route: string) {
  const path = route.replace(/^\//, "");
  return new URL(path && !path.endsWith("/") ? `${path}/` : path, siteBaseURL)
    .href;
}
