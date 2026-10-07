// Central extension release configuration.
//
// In the next stage this will be fetched from the Linux extension-release
// endpoint. For now, no release metadata is available — the UI shows
// "Extension download coming soon" and the download button is disabled.
//
// Expected release metadata shape (for the future endpoint):
// {
//   channel: "stable",
//   browser: "chromium",
//   version: "0.2.1",
//   download_url: "https://...",
//   sha256: "...",
//   published_at: "2026-10-07T..."
// }
//
// Architected so Firefox can be added as a second release without redesigning
// the page — just add a "firefox" entry here (or fetch it from the endpoint).

const RELEASES = {
  chromium: null,
  firefox: null
};

export function getLatestRelease(browser = "chromium") {
  return RELEASES[browser] || null;
}

export function isDownloadAvailable(browser = "chromium") {
  const r = getLatestRelease(browser);
  return !!(r && r.download_url && r.version);
}