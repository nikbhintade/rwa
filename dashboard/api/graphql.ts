export const config = { runtime: "edge" };

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", {
      status: 405,
      headers: { Allow: "POST" },
    });
  }

  const endpoint = process.env.GRAPHQL_ENDPOINT;
  if (!endpoint) {
    return new Response(
      JSON.stringify({ errors: [{ message: "GRAPHQL_ENDPOINT not configured" }] }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  const body = await req.text();

  const upstream = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });

  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      "Content-Type":
        upstream.headers.get("content-type") ?? "application/json",
    },
  });
}
