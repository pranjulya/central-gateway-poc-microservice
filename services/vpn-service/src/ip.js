const DEFAULT_BASE_IP = process.env.VPN_BASE_IP || '10.0.0.10';
let anchorNumber = ipToNumber(DEFAULT_BASE_IP);
let offset = 0;

export function peekNextIp() {
  return numberToIp(anchorNumber + offset);
}

export function nextIp() {
  const ip = peekNextIp();
  offset += 1;
  return ip;
}

export function reset(startFrom = DEFAULT_BASE_IP) {
  const base = ipToNumber(startFrom);
  anchorNumber = base;
  offset = 0;
}

function ipToNumber(ipAddress) {
  const parts = ipAddress.split('.').map((segment) => Number.parseInt(segment, 10));
  if (parts.length !== 4 || parts.some((segment) => Number.isNaN(segment) || segment < 0 || segment > 255)) {
    throw new Error(`Invalid IP address: ${ipAddress}`);
  }
  return ((parts[0] << 24) >>> 0) + (parts[1] << 16) + (parts[2] << 8) + parts[3];
}

function numberToIp(num) {
  return [
    (num >>> 24) & 0xff,
    (num >>> 16) & 0xff,
    (num >>> 8) & 0xff,
    num & 0xff,
  ].join('.');
}
