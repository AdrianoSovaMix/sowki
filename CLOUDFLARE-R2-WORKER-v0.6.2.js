const SUPABASE_URL = "https://wztxwoernzjjarprrzjl.supabase.co";
const SUPABASE_KEY = "sb_publishable_4a9Y97xC6e8JlF_mXO71EQ_5eR_BnSH";
const PUBLIC_MEDIA_BASE = "https://media.sowkitarczyn.pl";

const ALLOWED_ORIGINS = new Set([
  "https://sowkitarczyn.pl",
  "https://www.sowkitarczyn.pl",
]);

const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

function corsHeaders(origin) {
  const headers = {
    "Vary": "Origin",
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type, X-Sowki-Path",
    "Access-Control-Max-Age": "86400",
  };

  if (ALLOWED_ORIGINS.has(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }

  return headers;
}

function json(data, status = 200, origin = "") {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...corsHeaders(origin),
    },
  });
}

function isAllowedPath(path) {
  return /^(events|menus|announcements|survey-results|gallery)\/[A-Za-z0-9._-]+\.webp$/i.test(path);
}

async function isSowkiAdmin(request) {
  const auth = request.headers.get("Authorization") || "";

  if (!auth.startsWith("Bearer ")) {
    return false;
  }

  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/rpc/is_sowki_admin_public`,
    {
      method: "POST",
      headers: {
        "apikey": SUPABASE_KEY,
        "Authorization": auth,
        "Content-Type": "application/json",
      },
      body: "{}",
    }
  );

  if (!response.ok) {
    return false;
  }

  try {
    return (await response.json()) === true;
  } catch {
    return false;
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin") || "";

    if (request.method === "OPTIONS") {
      if (!ALLOWED_ORIGINS.has(origin)) {
        return new Response(null, { status: 403 });
      }

      return new Response(null, {
        status: 204,
        headers: corsHeaders(origin),
      });
    }

    if (url.pathname === "/" || url.pathname === "/health") {
      return json(
        {
          ok: true,
          service: "sowki-media-upload",
          bucketBound: !!env.MEDIA_BUCKET,
        },
        200,
        origin
      );
    }

    if (!ALLOWED_ORIGINS.has(origin)) {
      return json({ ok: false, error: "Origin not allowed." }, 403, origin);
    }

    const admin = await isSowkiAdmin(request);

    if (!admin) {
      return json({ ok: false, error: "Unauthorized." }, 401, origin);
    }

    if (url.pathname === "/upload" && request.method === "POST") {
      const path = (request.headers.get("X-Sowki-Path") || "").trim();
      const contentType = (request.headers.get("Content-Type") || "")
        .split(";")[0]
        .trim()
        .toLowerCase();

      if (!isAllowedPath(path)) {
        return json(
          { ok: false, error: "Invalid object path." },
          400,
          origin
        );
      }

      if (contentType !== "image/webp") {
        return json(
          { ok: false, error: "Only image/webp is allowed." },
          415,
          origin
        );
      }

      const bytes = await request.arrayBuffer();

      if (!bytes.byteLength) {
        return json({ ok: false, error: "Empty upload." }, 400, origin);
      }

      if (bytes.byteLength > MAX_UPLOAD_BYTES) {
        return json(
          { ok: false, error: "File is too large." },
          413,
          origin
        );
      }

      const result = await env.MEDIA_BUCKET.put(path, bytes, {
        httpMetadata: {
          contentType: "image/webp",
          cacheControl: "public, max-age=31536000, immutable",
        },
      });

      return json(
        {
          ok: true,
          path,
          size: bytes.byteLength,
          etag: result?.etag || null,
          publicUrl: `${PUBLIC_MEDIA_BASE}/${path}`,
        },
        200,
        origin
      );
    }

    if (url.pathname === "/delete" && request.method === "DELETE") {
      const path = (url.searchParams.get("path") || "").trim();

      if (!isAllowedPath(path)) {
        return json(
          { ok: false, error: "Invalid object path." },
          400,
          origin
        );
      }

      await env.MEDIA_BUCKET.delete(path);

      return json({ ok: true, deleted: path }, 200, origin);
    }

    return json({ ok: false, error: "Not found." }, 404, origin);
  },
};
