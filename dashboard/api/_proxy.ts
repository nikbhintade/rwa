// Shared GraphQL proxy. Each indexer gets its own /api route that binds one
// endpoint env var, so the browser never sees upstream URLs. Underscore-prefixed,
// so Vercel treats this as a helper module rather than a routable function.
export function makeGraphqlProxy(envVar: string) {
  return async function handler(req: Request): Promise<Response> {
    if (req.method !== "POST") {
      return new Response("Method Not Allowed", {
        status: 405,
        headers: { Allow: "POST" },
      });
    }

    const endpoint = process.env[envVar];
    if (!endpoint) {
      return new Response(
        JSON.stringify({ errors: [{ message: `${envVar} not configured` }] }),
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
  };
}
