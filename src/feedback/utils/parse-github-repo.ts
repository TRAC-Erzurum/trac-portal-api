/**
 * Normalize GITHUB_REPO_WEB_URL for health + Octokit owner/repo.
 * Accepts https/http, optional www, .git suffix, trailing slash, and paths after repo (e.g. /tree/main).
 */
export function parseGithubRepoWebUrl(
  raw: string | undefined,
): { owner: string; repo: string; githubRepoUrl: string; githubIssuesUrl: string } | null {
  if (!raw?.trim()) {
    return null;
  }
  let s = raw.trim();
  if (!/^https?:\/\//i.test(s)) {
    s = `https://${s}`;
  }
  let url: URL;
  try {
    url = new URL(s);
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^www\./i, '').toLowerCase();
  if (host !== 'github.com') {
    return null;
  }
  const parts = url.pathname.split('/').filter(Boolean);
  if (parts.length < 2) {
    return null;
  }
  const owner = parts[0];
  let repo = parts[1];
  repo = repo.replace(/\.git$/i, '');
  if (!owner || !repo) {
    return null;
  }
  const githubRepoUrl = `https://github.com/${owner}/${repo}`;
  return {
    owner,
    repo,
    githubRepoUrl,
    githubIssuesUrl: `${githubRepoUrl}/issues`,
  };
}
