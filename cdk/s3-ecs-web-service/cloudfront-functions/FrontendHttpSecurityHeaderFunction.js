function handler(event) {
  const response = event.response;
  const headers = response.headers;
  headers["strict-transport-security"] = {
    value: "max-age=63072000; includeSubdomains; preload",
  };
  headers["content-security-policy"] = {
    value:
      "default-src 'self' https:; " +
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https:; " +
      "style-src 'self' 'unsafe-inline' https:; " +
      "font-src 'self' data: https:; " +
      "img-src 'self' data: https:; " +
      "media-src 'self' https:; " +
      "connect-src 'self' https:; " +
      "frame-src 'self' https:; " +
      "object-src 'none';",
  };
  headers["x-content-type-options"] = { value: "nosniff" };
  headers["x-frame-options"] = { value: "DENY" };
  headers["x-xss-protection"] = { value: "1; mode=block" };
  return response;
}
