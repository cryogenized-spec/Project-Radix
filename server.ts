import express from 'express';
import { createServer as createViteServer } from 'vite';
import net from 'net';
import webpush from 'web-push';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' })); // Allow large attachments

  // API routes FIRST
  app.get('/api/gopher', async (req, res) => {
    try {
      let url = req.query.url as string;
      if (!url) return res.status(400).json({ message: 'Missing url parameter' });

      const match = url.match(/^gopher:\/\/([^:\/]+)(?::(\d+))?(?:\/([0-9a-zA-Z])(.*))?$/);
      if (!match) return res.status(400).json({ message: 'Invalid gopher URL' });

      const host = match[1];
      const port = parseInt(match[2] || '70', 10);
      const type = match[3] || '1';
      const selector = match[4] || '';

      const client = new net.Socket();
      let data = '';
      
      client.connect(port, host, () => {
        client.write(selector + '\r\n');
      });

      client.on('data', (chunk) => {
        data += chunk.toString('utf8');
      });

      client.on('close', () => {
        res.json({ type, content: data });
      });

      client.on('error', (err) => {
        if (!res.headersSent) {
            res.status(500).json({ message: err.message });
        }
      });
      
      client.setTimeout(10000);
      client.on('timeout', () => {
        client.destroy();
        if (!res.headersSent) {
            res.status(504).json({ message: 'Gopher request timed out' });
        }
      });

    } catch (error: any) {
      if (!res.headersSent) {
          res.status(500).json({ message: error.message });
      }
    }
  });

  app.post('/api/exa/search', async (req, res) => {
    try {
      const apiKey = req.headers['x-api-key'] as string;
      if (!apiKey) return res.status(401).json({ message: 'Missing API Key' });

      const response = await fetch('https://api.exa.ai/search', {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(req.body)
      });

      const data = await response.json();
      if (!response.ok) return res.status(response.status).json(data);
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post('/api/exa/findSimilar', async (req, res) => {
    try {
      const apiKey = req.headers['x-api-key'] as string;
      if (!apiKey) return res.status(401).json({ message: 'Missing API Key' });

      const response = await fetch('https://api.exa.ai/findSimilar', {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(req.body)
      });

      const data = await response.json();
      if (!response.ok) return res.status(response.status).json(data);
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get('/api/rss', async (req, res) => {
    try {
      let url = req.query.url as string;
      if (!url) return res.status(400).json({ message: 'Missing url parameter' });

      // Fallback logic for RSSHub
      const rssHubInstances = [
        'https://rsshub.app',
        'https://rsshub.rssforever.com',
        'https://rsshub.mxd.pub',
        'https://rss.shab.fun',
        'https://rsshub.pseudoyu.com'
      ];

      let isRssHub = false;
      let rssHubPath = '';
      
      for (const instance of rssHubInstances) {
        if (url.startsWith(instance)) {
          isRssHub = true;
          rssHubPath = url.substring(instance.length);
          break;
        }
      }

      // If it's a direct t.me link, convert it to RSSHub path
      if (url.includes('t.me/') && !isRssHub) {
        const match = url.match(/t\.me\/(?:s\/)?([a-zA-Z0-9_]+)/);
        if (match && match[1]) {
          isRssHub = true;
          rssHubPath = `/telegram/channel/${match[1]}`;
        }
      }

      // Fallback logic for Nitter
      const nitterInstances = [
        'https://nitter.net',
        'https://nitter.cz',
        'https://nitter.privacydev.net',
        'https://nitter.poast.org',
        'https://nitter.moomoo.me'
      ];

      let isNitter = false;
      let nitterPath = '';

      for (const instance of nitterInstances) {
        if (url.startsWith(instance)) {
          isNitter = true;
          nitterPath = url.substring(instance.length);
          break;
        }
      }

      // If it's a direct x.com or twitter.com link, convert it to Nitter path
      if ((url.includes('x.com/') || url.includes('twitter.com/')) && !isNitter) {
        const match = url.match(/(?:x\.com|twitter\.com)\/([a-zA-Z0-9_]+)/);
        if (match && match[1]) {
          isNitter = true;
          nitterPath = `/${match[1]}/rss`;
        }
      }

      const fetchWithTimeout = async (fetchUrl: string, timeoutMs: number = 5000) => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
        try {
          const response = await fetch(fetchUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
              'Accept': 'application/rss+xml, application/rdf+xml, application/atom+xml, application/xml, text/xml, text/html, */*',
              'Accept-Language': 'en-US,en;q=0.9',
              'Cache-Control': 'no-cache',
            },
            redirect: 'follow',
            signal: controller.signal
          });
          clearTimeout(timeoutId);
          return response;
        } catch (error) {
          clearTimeout(timeoutId);
          throw error;
        }
      };

      let response;
      let lastError;

      if (isRssHub) {
        // Try multiple instances for non-telegram RSSHub
        for (const instance of rssHubInstances) {
          try {
            const tryUrl = `${instance}${rssHubPath}`;
            response = await fetchWithTimeout(tryUrl, 8000);
            if (response.ok) {
              break; // Success!
            }
          } catch (e: any) {
            lastError = e;
            // Continue to next instance
          }
        }
      } else if (isNitter) {
        // Mock Nitter feed with 3 fake posts
        const fakeNitterRss = `<?xml version="1.0" encoding="UTF-8"?>
          <rss version="2.0">
            <channel>
              <title>Mocked X Feed</title>
              <link>https://x.com</link>
              <description>Mocked X feed for testing</description>
              <item>
                <title>First Fake X Post</title>
                <description><![CDATA[This is the first mocked post from X. #testing]]></description>
                <pubDate>${new Date().toUTCString()}</pubDate>
                <link>https://x.com/mock/status/1</link>
              </item>
              <item>
                <title>Second Fake X Post</title>
                <description><![CDATA[Here is another mocked post. The internet is disconnected!]]></description>
                <pubDate>${new Date(Date.now() - 3600000).toUTCString()}</pubDate>
                <link>https://x.com/mock/status/2</link>
              </item>
              <item>
                <title>Third Fake X Post</title>
                <description><![CDATA[Final mocked post for this feed. Everything is working locally.]]></description>
                <pubDate>${new Date(Date.now() - 7200000).toUTCString()}</pubDate>
                <link>https://x.com/mock/status/3</link>
              </item>
            </channel>
          </rss>`;
        return res.send(fakeNitterRss);
      } else {
        // Normal fetch
        response = await fetchWithTimeout(url, 10000);
      }
      
      if (!response || !response.ok) {
        let errorText = response ? response.statusText : (lastError?.message || 'Unknown error');
        try {
            if (response) {
              const text = await response.text();
              if (text && text.length < 500) {
                  errorText = `${response.statusText} - ${text}`;
              }
            }
        } catch (e) {}
        return res.status(response ? response.status : 500).json({ message: `Failed to fetch RSS: ${errorText}` });
      }

      const text = await response.text();
      res.send(text);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get('/api/telegram-media', async (req, res) => {
    try {
      const postUrl = req.query.url as string;
      if (!postUrl) return res.status(400).json({ message: 'Missing url parameter' });

      // Fetch the Telegram post HTML
      const htmlResponse = await fetch(`${postUrl}?embed=1&dark=1`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      });
      
      if (!htmlResponse.ok) {
        return res.status(htmlResponse.status).json({ message: `Failed to fetch Telegram post: ${htmlResponse.statusText}` });
      }

      const html = await htmlResponse.text();
      
      // Extract image URL from the HTML
      // Look for background-image:url('...') in tgme_widget_message_photo_wrap
      let imageUrl = '';
      const bgMatch = html.match(/background-image:url\('([^']+)'\)/);
      if (bgMatch && bgMatch[1]) {
        imageUrl = bgMatch[1];
      } else {
        // Fallback to og:image
        const ogMatch = html.match(/<meta property="og:image" content="([^"]+)"/);
        if (ogMatch && ogMatch[1]) {
          imageUrl = ogMatch[1];
        }
      }

      if (!imageUrl) {
        return res.status(404).json({ message: 'No media found in this post' });
      }

      // Fetch the actual image
      const imageResponse = await fetch(imageUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Referer': 'https://t.me/'
        }
      });

      if (!imageResponse.ok) {
        return res.status(imageResponse.status).json({ message: `Failed to fetch image: ${imageResponse.statusText}` });
      }

      const buffer = await imageResponse.arrayBuffer();
      const contentType = imageResponse.headers.get('content-type') || 'image/jpeg';
      
      res.setHeader('Content-Type', contentType);
      res.send(Buffer.from(buffer));
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post('/api/hf/generate', async (req, res) => {
    try {
      const { model, apiKey, ...params } = req.body;
      if (!apiKey) return res.status(401).json({ error: 'Missing API Key' });
      if (!model) return res.status(400).json({ error: 'Missing model' });

      const url = `https://router.huggingface.co/hf-inference/models/${model}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(params)
      });

      if (response.status === 503) {
        const errorData = await response.json();
        return res.status(503).json(errorData);
      }

      if (!response.ok) {
        let errorMsg = `HTTP error! status: ${response.status}`;
        try {
          const errJson = await response.json();
          errorMsg = errJson.error || errorMsg;
        } catch (e) {}
        return res.status(response.status).json({ error: errorMsg });
      }

      const buffer = await response.arrayBuffer();
      const contentType = response.headers.get('content-type') || 'image/jpeg';
      
      res.setHeader('Content-Type', contentType);
      res.send(Buffer.from(buffer));
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/radix-dispatch', async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        return res.status(401).json({ message: 'Missing Authorization header' });
      }

      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(req.body)
      });

      const data = await response.json();
      
      if (!response.ok) {
        return res.status(response.status).json(data);
      }

      res.json(data);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Task 3: The API Handler
  // Draft the /api/agent-cron serverless function boilerplate.
  app.all('/api/agent-cron', async (req, res) => {
    try {
      // Secure by checking for a Bearer token matching a CRON_SECRET environment variable
      const authHeader = req.headers.authorization;
      const expectedToken = process.env.CRON_SECRET;
      
      if (!expectedToken) {
        console.warn('CRON_SECRET is not set in environment variables.');
      } else if (authHeader !== `Bearer ${expectedToken}`) {
        return res.status(401).json({ message: 'Unauthorized: Invalid CRON_SECRET' });
      }

      // In a real serverless environment with a shared database (e.g., Vercel KV, Postgres, Firebase),
      // we would fetch the "Virtual Cron" registry here.
      // Since the frontend currently manages this in IndexedDB (client-side),
      // this boilerplate assumes a database connection exists to fetch the jobs.
      
      // const jobs = await db.collection('agent_jobs').find({}).toArray();
      const mockJobs = [
        { id: '1', scheduleType: 'interval', scheduleValue: '2', description: 'Check emails', nextRun: Date.now() - 1000 }
      ];

      const now = Date.now();
      const executedJobs = [];

      for (const job of mockJobs) {
        if (job.nextRun && job.nextRun <= now) {
          // Trigger the AI agent logic for jobs that are due
          console.log(`Executing AI Agent job: ${job.id} - ${job.description}`);
          
          // TODO: Implement actual AI agent logic here (e.g., calling Gemini API)
          // await executeAgentTask(job);

          // Update nextRun in database
          // await db.collection('agent_jobs').updateOne({ id: job.id }, { $set: { lastRun: now, nextRun: calculateNextRun(job) } });
          
          executedJobs.push(job.id);
        }
      }

      res.status(200).json({ 
        message: 'Cron execution completed', 
        executedJobs,
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      console.error('Cron job error:', error);
      res.status(500).json({ message: 'Internal server error during cron execution' });
    }
  });

  app.post('/api/dispatch-alert', async (req, res) => {
    try {
      const { subscription, payload } = req.body;

      if (!subscription) {
        return res.status(400).json({ message: 'Missing subscription object' });
      }

      const publicKey = process.env.VITE_VAPID_PUBLIC_KEY || 'BDQ_jLH36RMyWtb17fz7gYDSXWw5zgw2_5aZ_yZhJHimNQg3JKRJ6w0iy2n-0c8hrLxRQbRn2C3d8O8OHl75Cx8';
      const privateKey = process.env.VAPID_PRIVATE_KEY || 'WDDrU6ozVNenIgN8x1uKsLMsvvyOp4njT9LBhOM7LBA';

      if (!publicKey || !privateKey) {
        return res.status(500).json({ message: 'VAPID keys are not configured on the server' });
      }

      webpush.setVapidDetails(
        'mailto:admin@projectradix.com',
        publicKey,
        privateKey
      );

      const pushPayload = JSON.stringify(payload || {
        title: 'Project RADIX',
        body: 'You have a new alert from your AI Agent.'
      });

      await webpush.sendNotification(subscription, pushPayload);
      res.status(200).json({ message: 'Push notification dispatched successfully' });
    } catch (error: any) {
      console.error('Error dispatching push notification:', error);
      res.status(500).json({ message: 'Failed to dispatch push notification', error: error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static('dist'));
    app.get('*', (req, res) => {
      res.sendFile('dist/index.html', { root: '.' });
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
