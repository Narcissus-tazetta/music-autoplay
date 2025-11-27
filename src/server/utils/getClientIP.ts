export function getClientIP(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const ips = forwardedFor.split(",").map((ip) => ip.trim());
    return ips[0];
  }

  const realIP = request.headers.get("x-real-ip");
  if (realIP) return realIP.trim();

  return "unknown";
}
