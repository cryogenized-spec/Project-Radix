import { getSetting } from './db';
import { decryptApiKey } from './apiKeyCrypto';

export interface ExaResult {
  title: string;
  url: string;
  id: string;
  score: number;
  publishedDate?: string;
  author?: string;
  text?: string;
  highlights?: string[];
}

export async function searchExa(query: string, domain?: string, nextPage?: string): Promise<{results: ExaResult[], nextPage?: string}> {
  const encryptedApiKey = await getSetting('exaApiKey');
  const apiKey = await decryptApiKey(encryptedApiKey || '');
  if (!apiKey) {
    throw new Error('Exa API Key not found. Please add it in API Lockbox.');
  }

  const body: any = {
    query,
    numResults: 10,
    contents: {
      text: { includeHtmlTags: true },
      highlights: { includeHtmlTags: true }
    }
  };

  if (domain) {
    if (domain === 'x.com' || domain === 'twitter.com') {
      body.category = 'tweet';
    } else {
      body.includeDomains = [domain];
    }
  }
  
  if (nextPage) {
    body.nextPage = nextPage;
  }

  const response = await fetch('/api/exa/search', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Exa API Error: ${response.status} ${err}`);
  }

  const data = await response.json();
  return { results: data.results || [], nextPage: data.nextPage };
}

export async function findSimilarExa(url: string, domain?: string, nextPage?: string): Promise<{results: ExaResult[], nextPage?: string}> {
  const encryptedApiKey = await getSetting('exaApiKey');
  const apiKey = await decryptApiKey(encryptedApiKey || '');
  if (!apiKey) {
    throw new Error('Exa API Key not found. Please add it in API Lockbox.');
  }

  const body: any = {
    url,
    numResults: 10,
    contents: {
      text: { includeHtmlTags: true },
      highlights: { includeHtmlTags: true }
    }
  };

  if (domain) {
    if (domain === 'x.com' || domain === 'twitter.com') {
      body.category = 'tweet';
    } else {
      body.includeDomains = [domain];
    }
  }

  if (nextPage) {
    body.nextPage = nextPage;
  }

  const response = await fetch('/api/exa/findSimilar', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Exa API Error: ${response.status} ${err}`);
  }

  const data = await response.json();
  return { results: data.results || [], nextPage: data.nextPage };
}
