const LOCAL_ORIGIN_PATTERN = /^https?:\/\/(?:(?:[^:]+\.)?localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/i;

const WIX_ORIGIN_PATTERNS = [
  /^https:\/\/(?:[a-z0-9-]+\.)*(?:editor|studio|harmony)\.wix\.com$/i,
  /^https:\/\/[a-z0-9-]+\.wixsite\.com$/i,
  /^https:\/\/[a-z0-9-]+\.wixstudio\.io$/i,
  /^https:\/\/[a-z0-9-]+\.wix\.run$/i,
  /^https:\/\/dev-[a-z0-9-]+\.wixdev-sites\.org$/i,
];

function parseExplicitOrigins(value) {
  if (!value?.trim()) return [];

  return value.split(',').map((origin) => origin.trim()).filter(Boolean).map((origin) => {
    let parsed;
    try {
      parsed = new URL(origin);
    } catch {
      throw new Error('WIX_DEV_CORS_ORIGINS must contain complete origins, such as https://example.com, without paths.');
    }

    if (parsed.origin !== origin || (parsed.protocol !== 'https:' && !LOCAL_ORIGIN_PATTERN.test(origin))) {
      throw new Error('WIX_DEV_CORS_ORIGINS must contain exact HTTPS origins (or localhost origins), without paths.');
    }
    return origin;
  });
}

export function getAllowedDevCorsOrigins(explicitOrigins = '') {
  return [LOCAL_ORIGIN_PATTERN, ...WIX_ORIGIN_PATTERNS, ...parseExplicitOrigins(explicitOrigins)];
}

export function isAllowedDevCorsOrigin(origin, explicitOrigins = '') {
  return getAllowedDevCorsOrigins(explicitOrigins).some((candidate) =>
    typeof candidate === 'string' ? candidate === origin : candidate.test(origin),
  );
}
