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
              debug
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

    debug.push("API URL hidden: https://api.getsong.co/search/?api_key=***&type=both&lookup=...");

    // API Request
    let response;
    try {
      response = await fetch(apiUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0"
        }
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
            debug
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

      // ---------- NULL-RESULT BEI KEINEM TREFFER ----------
      if (exactMatches.length === 0) {
        return new Response(
          JSON.stringify(
            {
              query: { title, artist },
              strict: true,
              result: null
            },
            null,
            2
          ),
          { headers: { "Content-Type": "application/json" } }
        );
      }
      // ----------------------------------------------------

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
                bpm: best.tempo ?? null
              }
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
              data: { search: [best] }
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
        bpm: item.tempo ?? null
      }));

      return new Response(
        JSON.stringify(
          {
            query: { title, artist },
            strict: false,
            results: mapped,
            debug
          },
          null,
          2
        ),
        { headers: { "Content-Type": "application/json" } }
      );
    }

    // Vollmodus ohne strict
    return new Response(
      JSON.stringify({ query: { title, artist }, strict: false, data, debug }, null, 2),
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
