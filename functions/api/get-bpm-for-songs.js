// functions/get-bpm-for-songs.js

/**
 * Cloudflare Pages Function
 * Route: /get-bpm-for-songs
 *
 * Call example:
 *   /get-bpm-for-songs?q=Song Title|Artist Name&q=Another Song|Another Artist
 *
 * Max 15 q parameters per request.
 */

const API_BASE = "https://api.getsong.co/search/";

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  const origin = request.headers.get("Origin") || "*";

  const corsHeaders = {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Requested-With",
  };

  // Handle CORS preflight
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  const queries = url.searchParams.getAll("q");

  if (!queries.length) {
    return jsonResponse(
      { error: "Missing query parameter 'q'. Use ?q=Title|Artist (multiple q allowed)." },
      400,
      corsHeaders
    );
  }

  if (queries.length > 15) {
    return jsonResponse(
      { error: "Too many songs. Max 15 'q' parameters per request." },
      400,
      corsHeaders
    );
  }

  if (!env.GETSONGBPM_API_KEY) {
    return jsonResponse(
      { error: "Server misconfiguration: GETSONGBPM_API_KEY is not set." },
      500,
      corsHeaders
    );
  }

  const results = [];

  for (const q of queries) {
    const [rawTitle = "", rawArtist = ""] = q.split("|");

    const title = rawTitle.trim();
    const artist = rawArtist.trim();

    if (!title) {
      results.push({
        inputTitle: rawTitle,
        inputArtist: rawArtist,
        found: false,
        reason: "Missing song title in 'q' parameter.",
      });
      continue;
    }

    // Build lookup: "song:..." plus optional "artist:..."
    let lookup = `song:${title}`;
    if (artist) {
      lookup += ` artist:${artist}`;
    }

    const apiUrl = new URL(API_BASE);
    apiUrl.searchParams.set("api_key", env.GETSONGBPM_API_KEY);
    apiUrl.searchParams.set("type", "both");
    apiUrl.searchParams.set("lookup", lookup);
    apiUrl.searchParams.set("limit", "1");

    try {
      const resp = await fetch(apiUrl.toString());

      if (!resp.ok) {
        results.push({
          inputTitle: title,
          inputArtist: artist,
          found: false,
          reason: `API error: HTTP ${resp.status}`,
        });
        continue;
      }

      const data = await resp.json();
      const items = data.search || [];

      if (!items.length) {
        results.push({
          inputTitle: title,
          inputArtist: artist,
          found: false,
          reason: "No results",
        });
        continue;
      }

      const song = items[0];

      results.push({
        inputTitle: title,
        inputArtist: artist,
        found: true,
        tempo: song.tempo ? Number(song.tempo) : null,
        title: song.title || null,
        artist: (song.artist && song.artist.name) || null,
        songId: song.id || null,
        songUrl: song.uri || null,
        // optional extras, falls du damit spielen willst:
        timeSig: song.time_sig || null,
        keyOf: song.key_of || null,
        openKey: song.open_key || null,
        danceability: song.danceability ?? null,
        acousticness: song.acousticness ?? null,
      });
    } catch (err) {
      results.push({
        inputTitle: title,
        inputArtist: artist,
        found: false,
        reason: "Network or parsing error",
        details: String(err),
      });
    }

    // Mini Delay, falls du ganz paranoid bzgl. Rate Limits sein willst:
    // await new Promise(r => setTimeout(r, 50));
  }

  return jsonResponse(results, 200, corsHeaders);
}

function jsonResponse(body, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...extraHeaders,
    },
  });
}
