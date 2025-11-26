const REQUEST_DELAY_MS = 300;

// kleines Sleep-Helper für Delay zwischen Requests
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Multi-Song Handler: nutzt dieselbe Logik wie Single, aber pro Eintrag
async function handleMultiSongs(apiKey, q, simpleMode, strictMode) {
  const entries = q
    .split(";")
    .map((e) => e.trim())
    .filter((e) => e.length > 0);

  const results = [];

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const parts = entry.split("|");
    const title = (parts[0] || "").trim();
    const artist = (parts[1] || "").trim();

    if (!title || !artist) {
      results.push({
        query: { title, artist },
        strict: strictMode,
        result: null,
        error: "Invalid q format. Expected 'Title|Artist'",
      });
      continue;
    }

    // Normalisierung wie in der Single-Logik
    const normalize = (s) =>
      s.toLowerCase().trim().replace(/\s+/g, " ");

    const normTitle = normalize(title);
    const normArtist = normalize(artist);

    const lookup =
      "song:" +
      encodeURIComponent(title) +
      " artist:" +
      encodeURIComponent(artist);

    const apiUrl =
      "https://api.getsong.co/search/?" +
      "api_key=" + apiKey +
      "&type=both" +
      "&lookup=" + lookup;

    let data;
    try {
      const resp = await fetch(apiUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0",
        },
      });
      const text = await resp.text();
      data = JSON.parse(text);
    } catch (err) {
      results.push({
        query: { title, artist },
        strict: strictMode,
        result: null,
        error: "Fetch or parse failed",
      });
      continue;
    }

    const list = Array.isArray(data.search) ? data.search : [];

    if (strictMode) {
      // STRICT: exakte Matches filtern
      const exactMatches = list.filter((item) => {
        const apiTitle = normalize(item.title || "");
        const apiArtist = normalize(
          (item.artist && item.artist.name) || ""
        );
        return apiTitle === normTitle && apiArtist === normArtist;
      });

      if (exactMatches.length === 0) {
        results.push({
          query: { title, artist },
          strict: true,
          result: null,
        });
      } else {
        // ältestes Jahr wählen
        exactMatches.sort((a, b) => {
          const ya =
            a.album && typeof a.album.year === "number"
              ? a.album.year
              : 9999;
          const yb =
            b.album && typeof b.album.year === "number"
              ? b.album.year
              : 9999;
          return ya - yb;
        });

        const best = exactMatches[0];

        if (simpleMode) {
          results.push({
            query: { title, artist },
            strict: true,
            result: {
              id: best.id || null,
              title: best.title || null,
              artist: (best.artist && best.artist.name) || null,
              bpm: best.tempo || null,
            },
          });
        } else {
          results.push({
            query: { title, artist },
            strict: true,
            data: { search: [best] },
          });
        }
      }
    } else {
      // NON-STRICT
      if (simpleMode) {
        const mapped = list.map((item) => ({
          id: item.id || null,
          title: item.title || null,
          artist: (item.artist && item.artist.name) || null,
          bpm: item.tempo || null,
        }));

        results.push({
          query: { title, artist },
          strict: false,
          results: mapped,
        });
      } else {
        results.push({
          query: { title, artist },
          strict: false,
          data,
        });
      }
    }

    // Delay zwischen den Requests, außer nach dem letzten
    if (i < entries.length - 1) {
      await sleep(REQUEST_DELAY_MS);
    }
  }

  return { results };
}

export async function onRequest(context) {
  const debug = [];

  try {
    debug.push("Function invoked");

    // API Key
    const apiKey = context.env.GETSONGBPM_API_KEY;
    if (!apiKey) {
      debug.push("API key missing");
      return new Response(
        JSON.stringify({ error: "Missing API key", debug }, null, 2),
        { headers: { "Content-Type": "application/json" } }
      );
    }

    const urlObj = new URL(context.request.url);
    const q = urlObj.searchParams.get("q");
    const simpleMode = urlObj.searchParams.get("simple") === "1";
    const strictMode = urlObj.searchParams.get("strict") === "1";

    // 🔁 MULTI-SONG: q enthält ';'
    if (q && q.indexOf(";") !== -1) {
      const multiResult = await handleMultiSongs(
        apiKey,
        q,
        simpleMode,
        strictMode
      );
      return new Response(JSON.stringify(multiResult, null, 2), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // ❗ Ab hier: SINGLE-SONG-LOGIK wie vorher (unverändert)

    debug.push("q: " + q);
    debug.push("simpleMode: " + simpleMode);
    debug.push("strictMode: " + strictMode);

    let title = "Shape of You";
    let artist = "Ed Sheeran";

    // Parse q if present
    if (!q) {
      debug.push("No q parameter, using default song");
    } else {
      const parts = q.split("|");
      const t = parts[0] ? parts[0].trim() : "";
      const a = parts[1] ? parts[1].trim() : "";

      if (!t || !a) {
        debug.push("Invalid q format");
        return new Response(
          JSON.stringify(
            {
              error: "Invalid q format. Expected 'Title|Artist'",
              debug,
            },
            null,
            2
          ),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      title = t;
      artist = a;
    }

    // Normalisierung für strict-Matching
    const normalize = (s) =>
      s.toLowerCase().trim().replace(/\s+/g, " "); // keine Bindestrich-/Sonderzeichen-Normalisierung

    const normTitle = normalize(title);
    const normArtist = normalize(artist);

    const lookup =
      "song:" +
      encodeURIComponent(title) +
      " artist:" +
      encodeURIComponent(artist);

    const apiUrl =
      "https://api.getsong.co/search/?" +
      "api_key=" + apiKey +
      "&type=both" +
      "&lookup=" + lookup;

    debug.push(
      "API URL hidden: https://api.getsong.co/search/?api_key=***&type=both&lookup=..."
    );

    // API Request
    let response;
    try {
      response = await fetch(apiUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0",
        },
      });
    } catch (err) {
      debug.push("Fetch crash: " + err.message);
      return new Response(
        JSON.stringify({ error: "Fetch failed", debug }, null, 2),
        { headers: { "Content-Type": "application/json" } }
      );
    }

    const text = await response.text();
    debug.push("Response length: " + text.length);

    let data;
    try {
      data = JSON.parse(text);
    } catch (err) {
      debug.push("JSON parse fail: " + err.message);
      return new Response(
        JSON.stringify(
          {
            error: "Non-JSON response",
            preview: text.substring(0, 200),
            debug,
          },
          null,
          2
        ),
        { headers: { "Content-Type": "application/json" } }
      );
    }

    const results = Array.isArray(data.search) ? data.search : [];

    // STRICT MODE
    if (strictMode) {
      // Exakte Matches
      const exactMatches = results.filter((item) => {
        const apiTitle = normalize(item.title || "");
        const apiArtist = normalize(item.artist?.name || "");

        return apiTitle === normTitle && apiArtist === normArtist;
      });

      debug.push("Exact matches found: " + exactMatches.length);

      if (exactMatches.length === 0) {
        // Kein exaktes Ergebnis
        return new Response(
          JSON.stringify(
            {
              query: { title, artist },
              strict: true,
              result: null,
            },
            null,
            2
          ),
          { headers: { "Content-Type": "application/json" } }
        );
      }

      // Nach Jahr sortieren (ältestes zuerst)
      exactMatches.sort((a, b) => {
        const ya = a.album?.year ?? 9999;
        const yb = b.album?.year ?? 9999;
        return ya - yb;
      });

      const best = exactMatches[0];

      if (simpleMode) {
        return new Response(
          JSON.stringify(
            {
              query: { title, artist },
              strict: true,
              result: {
                id: best.id ?? null,
                title: best.title ?? null,
                artist: best.artist?.name ?? null,
                bpm: best.tempo ?? null,
              },
            },
            null,
            2
          ),
          { headers: { "Content-Type": "application/json" } }
        );
      } else {
        return new Response(
          JSON.stringify(
            {
              query: { title, artist },
              strict: true,
              data: { search: [best] },
            },
            null,
            2
          ),
          { headers: { "Content-Type": "application/json" } }
        );
      }
    }

    // NON-STRICT (normaler Modus)
    if (simpleMode) {
      const mapped = results.map((item) => ({
        id: item.id ?? null,
        title: item.title ?? null,
        artist: item.artist?.name ?? null,
        bpm: item.tempo ?? null,
      }));

      return new Response(
        JSON.stringify(
          {
            query: { title, artist },
            strict: false,
            results: mapped,
            debug,
          },
          null,
          2
        ),
        { headers: { "Content-Type": "application/json" } }
      );
    }

    // Vollmodus ohne strict
    return new Response(
      JSON.stringify(
        { query: { title, artist }, strict: false, data, debug },
        null,
        2
      ),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    const debug = ["Outer crash: " + err.message];
    return new Response(
      JSON.stringify({ error: "Unhandled failure", debug }),
      { headers: { "Content-Type": "application/json" } }
    );
  }
}
