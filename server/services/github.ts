import { Octokit } from '@octokit/rest';

// GitHub Integration Service
// Uses Replit's secure OAuth connection to authenticate with GitHub

let connectionSettings: any;

async function getAccessToken() {
  if (connectionSettings && connectionSettings.settings.expires_at && new Date(connectionSettings.settings.expires_at).getTime() > Date.now()) {
    return connectionSettings.settings.access_token;
  }
  
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken) {
    throw new Error('X_REPLIT_TOKEN not found for repl/depl');
  }

  connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=github',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  const accessToken = connectionSettings?.settings?.access_token || connectionSettings.settings?.oauth?.credentials?.access_token;

  if (!connectionSettings || !accessToken) {
    throw new Error('GitHub not connected');
  }
  return accessToken;
}

// WARNING: Never cache this client.
// Access tokens expire, so a new client must be created each time.
// Always call this function again to get a fresh client.
export async function getGitHubClient(): Promise<Octokit> {
  const accessToken = await getAccessToken();
  return new Octokit({ auth: accessToken });
}

// Get authenticated user info
export async function getAuthenticatedUser() {
  const client = await getGitHubClient();
  const { data } = await client.users.getAuthenticated();
  return data;
}

// List user's repositories
export async function listRepositories(options?: { per_page?: number; page?: number }) {
  const client = await getGitHubClient();
  const { data } = await client.repos.listForAuthenticatedUser({
    per_page: options?.per_page || 30,
    page: options?.page || 1,
    sort: 'updated',
  });
  return data;
}

// Get repository details
export async function getRepository(owner: string, repo: string) {
  const client = await getGitHubClient();
  const { data } = await client.repos.get({ owner, repo });
  return data;
}

// List repository issues
export async function listIssues(owner: string, repo: string, options?: { state?: 'open' | 'closed' | 'all'; per_page?: number }) {
  const client = await getGitHubClient();
  const { data } = await client.issues.listForRepo({
    owner,
    repo,
    state: options?.state || 'open',
    per_page: options?.per_page || 30,
  });
  return data;
}

// Create an issue
export async function createIssue(owner: string, repo: string, title: string, body?: string) {
  const client = await getGitHubClient();
  const { data } = await client.issues.create({
    owner,
    repo,
    title,
    body,
  });
  return data;
}
