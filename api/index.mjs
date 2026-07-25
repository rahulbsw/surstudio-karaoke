import app from "../server.mjs";

export default function handler(request, response) {
  const route = Array.isArray(request.query?.path)
    ? request.query.path.join("/")
    : String(request.query?.path || "");

  if (route) {
    const url = new URL(request.url, "http://127.0.0.1");
    url.pathname = `/api/${route}`;
    url.searchParams.delete("path");
    request.url = `${url.pathname}${url.search}`;
  }

  return app(request, response);
}
