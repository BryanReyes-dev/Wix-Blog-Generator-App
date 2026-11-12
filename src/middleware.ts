
import { defineMiddleware } from 'astro:middleware';
import { CORS_ALLOWED_ORIGINS } from 'astro:env/server';

const allowedOrigins = new Set(
  (CORS_ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
);

const allowedMethods = 'GET, HEAD, POST, PUT, PATCH, DELETE, OPTIONS';
const allowedHeaders = 'Authorization, Content-Type, x-wix-linguist';

export const onRequest = defineMiddleware(async (context, next) => {
  const { request, url } = context;

  // Only apply CORS to API routes.
  if (!url.pathname.startsWith('/api/')) {
    return next();
  }

  const origin = request.headers.get('Origin');

  // Allow requests that don't come from a browser origin.
  if (!origin) {
    return next();
  }

  // Reject origins that aren't explicitly trusted.
  if (!allowedOrigins.has(origin)) {
    return new Response(
      JSON.stringify({ error: 'Origin not allowed.' }),
      {
        status: 403,
        headers: {
          'Content-Type': 'application/json',
        },
      },
    );
  }

  // Handle browser CORS preflight requests.
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Methods': allowedMethods,
        'Access-Control-Allow-Headers': allowedHeaders,
        'Access-Control-Max-Age': '600',
        'Vary': 'Origin, Access-Control-Request-Method, Access-Control-Request-Headers',
      },
    });
  }

  // Let the actual API endpoint execute.
  const response = await next();

  // Add CORS headers to its response.
  const headers = new Headers(response.headers);

  headers.set('Access-Control-Allow-Origin', origin);

  const existingVary = headers.get('Vary');
  if (!existingVary?.toLowerCase().includes('origin')) {
    headers.set('Vary', existingVary ? `${existingVary}, Origin` : 'Origin');
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
});
