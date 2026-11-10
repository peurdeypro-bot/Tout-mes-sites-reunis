import { createReadStream, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchPronoteData } from './pronote-service.js';

const projectRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const host = process.env.HOST || '127.0.0.1';
const port = Number(process.env.PORT || 3000);
const maxBodyBytes = 12 * 1024;
const loginAttempts = new Map();
const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.gif': 'image/gif',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp'
};

const securityHeaders = {
  'Cache-Control': 'no-store',
  'Content-Security-Policy': "default-src 'self'; base-uri 'self'; connect-src 'self'; font-src 'self' https://fonts.gstatic.com data:; form-action 'self'; frame-ancestors 'none'; img-src 'self' data:; object-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY'
};

function sendJson(response, status, value) {
  response.writeHead(status, { ...securityHeaders, 'Content-Type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(value));
}

function sameOriginRequest(request) {
  const originHeader = request.headers.origin;
  if (!originHeader) return false;
  try {
    const origin = new URL(originHeader);
    const forwardedHosts = [request.headers.host, request.headers['x-forwarded-host']]
      .filter(Boolean)
      .flatMap((value) => value.split(',').map((hostValue) => hostValue.trim()));
    return forwardedHosts.includes(origin.host);
  } catch {
    return false;
  }
}

function readJson(request) {
  return new Promise((resolveBody, rejectBody) => {
    const chunks = [];
    let byteCount = 0;
    let tooLarge = false;
    request.on('data', (chunk) => {
      byteCount += chunk.length;
      if (byteCount > maxBodyBytes) {
        tooLarge = true;
        chunks.forEach((part) => part.fill(0));
        chunks.length = 0;
        return;
      }
      if (!tooLarge) chunks.push(chunk);
    });
    request.on('end', () => {
      if (tooLarge) {
        rejectBody(Object.assign(new Error('Request too large'), { status: 413 }));
        return;
      }
      const body = Buffer.concat(chunks);
      try {
        resolveBody(JSON.parse(body.toString('utf8')));
      } catch {
        rejectBody(Object.assign(new Error('Invalid JSON'), { status: 400 }));
      } finally {
        body.fill(0);
        chunks.forEach((part) => part.fill(0));
      }
    });
    request.on('error', rejectBody);
  });
}

function canAttemptLogin(address) {
  const now = Date.now();
  const previous = loginAttempts.get(address);
  if (!previous || now - previous.start > 10 * 60 * 1000) {
    loginAttempts.set(address, { start: now, count: 1 });
    return true;
  }
  if (previous.count >= 5) return false;
  previous.count += 1;
  return true;
}

function serveStatic(request, response, pathname) {
  let decodedPath;
  try {
    decodedPath = decodeURIComponent(pathname);
  } catch {
    response.writeHead(400, securityHeaders).end();
    return;
  }

  const normalizedPath = normalize(decodedPath).replace(/^([/\\])+/, '');
  const target = resolve(projectRoot, normalizedPath || 'index.html');
  const forbiddenSegments = target.slice(projectRoot.length).split(sep);
  if (!target.startsWith(projectRoot + sep) || forbiddenSegments.includes('node_modules')
    || forbiddenSegments.includes('.git') || /(^|\/)(\.env[^/]*|package(?:-lock)?\.json|server\.js|test_pronote\.js)$/i.test(decodedPath)) {
    response.writeHead(404, securityHeaders).end();
    return;
  }

  let filePath = target;
  try {
    if (statSync(filePath).isDirectory()) filePath = join(filePath, 'index.html');
    const fileInfo = statSync(filePath);
    const contentType = mimeTypes[extname(filePath).toLowerCase()];
    if (!fileInfo.isFile() || !contentType) throw new Error('Unsupported file');
    response.writeHead(200, { ...securityHeaders, 'Content-Length': fileInfo.size, 'Content-Type': contentType });
    if (request.method === 'HEAD') response.end();
    else createReadStream(filePath).pipe(response);
  } catch {
    response.writeHead(404, securityHeaders).end();
  }
}

const server = createServer(async (request, response) => {
  const requestUrl = new URL(request.url, 'http://localhost');
  if (requestUrl.pathname === '/api/pronote-data') {
    if (request.method !== 'POST') {
      sendJson(response, 405, { error: 'Méthode non autorisée.' });
      return;
    }
    if (!sameOriginRequest(request)) {
      sendJson(response, 403, { error: 'Origine de la requête refusée.' });
      return;
    }
    if (!request.headers['content-type']?.toLowerCase().startsWith('application/json')) {
      sendJson(response, 415, { error: 'Format de requête non accepté.' });
      return;
    }
    if (Number(request.headers['content-length'] || 0) > maxBodyBytes) {
      sendJson(response, 413, { error: 'Requête trop volumineuse.' });
      return;
    }

    const address = request.socket.remoteAddress || 'unknown';
    if (!canAttemptLogin(address)) {
      sendJson(response, 429, { error: 'Trop de tentatives. Réessaie dans quelques minutes.' });
      return;
    }

    let credentials;
    try {
      credentials = await readJson(request);
      if (!credentials || typeof credentials !== 'object' || Array.isArray(credentials)
        || typeof credentials.url !== 'string' || typeof credentials.username !== 'string'
        || typeof credentials.password !== 'string' || credentials.url.length > 2048
        || credentials.username.length > 256 || credentials.password.length > 512
        || (credentials.entProvider !== undefined && typeof credentials.entProvider !== 'string')
        || (credentials.entProvider && credentials.entProvider.length > 64)) {
        sendJson(response, 400, { error: 'Vérifie l’adresse et les champs de connexion.' });
        return;
      }
      if (!credentials.url || !credentials.username || !credentials.password) {
        sendJson(response, 400, { error: 'Adresse, identifiant et mot de passe sont requis.' });
        return;
      }
      let pronoteUrl;
      try {
        pronoteUrl = new URL(credentials.url);
      } catch {
        sendJson(response, 400, { error: 'Adresse Pronote invalide.' });
        return;
      }
      if (pronoteUrl.protocol !== 'https:' || pronoteUrl.username || pronoteUrl.password) {
        sendJson(response, 400, { error: 'Utilise une adresse Pronote HTTPS sans identifiants intégrés.' });
        return;
      }

      const data = await fetchPronoteData(credentials);
      data.grades.sort((first, second) => Date.parse(second.date) - Date.parse(first.date));
      loginAttempts.delete(address);
      sendJson(response, 200, data);
    } catch (error) {
      sendJson(response, error.status || 502, {
        error: error.status === 413 ? 'Requête trop volumineuse.' : 'Connexion Pronote impossible. Vérifie les informations et l’accès réseau.'
      });
    } finally {
      if (credentials && typeof credentials === 'object') {
        credentials.url = '';
        credentials.username = '';
        credentials.password = '';
        credentials.entProvider = '';
      }
    }
    return;
  }

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.writeHead(405, securityHeaders).end();
    return;
  }
  serveStatic(request, response, requestUrl.pathname);
});

server.listen(port, host, () => {
  console.log(`Serveur de démonstration disponible sur http://${host}:${port}`);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    server.close(() => process.exit(0));
  });
}
