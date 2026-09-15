const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '[::1]']);

function isPrivateIpv4(hostname: string) {
  const octets = hostname.split('.').map(Number);

  if (
    octets.length !== 4 ||
    octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)
  ) {
    return false;
  }

  return (
    octets[0] === 10 ||
    (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) ||
    (octets[0] === 192 && octets[1] === 168)
  );
}

export function parseCorsOrigins(value?: string) {
  if (!value) return new Set<string>();

  return new Set(
    value
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean)
      .map((origin) => new URL(origin).origin),
  );
}

export function isCorsOriginAllowed(
  origin: string | undefined,
  allowedOrigins: ReadonlySet<string>,
  isProduction: boolean,
) {
  if (!origin) return true;

  let parsedOrigin: URL;
  try {
    parsedOrigin = new URL(origin);
  } catch {
    return false;
  }

  if (allowedOrigins.has(parsedOrigin.origin)) return true;
  if (isProduction) return false;

  const usesWebProtocol =
    parsedOrigin.protocol === 'http:' || parsedOrigin.protocol === 'https:';

  return (
    usesWebProtocol &&
    (LOCAL_HOSTNAMES.has(parsedOrigin.hostname) ||
      isPrivateIpv4(parsedOrigin.hostname))
  );
}
