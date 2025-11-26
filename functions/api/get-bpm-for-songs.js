export async function onRequest(context) {
  const debug = [];

  // 750ms Delay-Funktion (Cloudflare kompatibel)
  const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

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

    if (!q) {
      return new Response(
        JSON.stringify(
          { error: "Missing q parameter. Use Title|Artist or multiple separated by ;" },
          null,
          2
        ),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // --------------------------------------------
    // MULTI-SONG MODE: Split at semicolon
    // --------------------------------------------
    const songQueries = q.split(";").map(x => x.trim()).filter(x => x.length > 0);

    // Normalizer as before (strict matching)
    const normalize = (s) =>
      s.toLowerCase().trim().replace(/\s+/g, " ");

    // Will store per-song results
    const finalResults = [];

    // --------------------------------------------
    // PROCESS EACH SONG INDIVIDUALLY
    // --------------------------------------------
    for (const entry of songQueries) {
      let [title, artist] = entry.split("|");

      if (!title || !artist) {
        finalResults.push({
          query: { title: title ?? null, artist: artist ?? null },
          strict: strictMode,
          result: null,
          error: "Invalid q format for this entry (expected Title|Artist)"
        });
        continue;
      }

      title = title.trim();
      artist = artist.trim();

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

      // --------------------------
      // Fetch API for this song
      // --------------------------
      let text;
      try {
        const r = await fetch(apiUrl, {
          headers: {
            "User-Agent": "Mozilla/5.0"
          }
        });

        text = await r.text();
      } catch (err) {
        finalResults.push({
          query: { title, artist },
          strict: strictMode,
          result: null,
          error: "Fetch failed: " + err.message
        });
        continue;
      }

      let data;
      try {
        data = JSON.parse(text);
      } catch (err) {
        finalResults.push({
          query: { title, artist },
          strict: strictMode,
          result: null,
          error: "Non-JSON response"
        });
        continue;
      }

      const results = Array.isArray(data.search) ? data.search : [];

      // --------------------------------------------
      // STRICT MATCHING (per your working version)
      // --------------------------------------------
      if (strictMode) {
        const exactMatches = results.filter((item) => {
          const apiTitle = normalize(item.title || "");
          const apiArtist = normalize(item.artist?.name || "");
          return apiTitle === normTitle && apiArtist === normArtist;
        });

        if (exactMatches.length === 0) {
          finalResults.push({
            query: { title, artist },
            strict: true,
            result: null
          });
        } else {
          // sort by album year ascending
          exactMatches.sort((a, b) => {
            const ya = a.album?.year ?? 9999;
            const yb = b.album?.year ?? 9999;
            return ya - yb;
          });

          const best = exactMatches[0];

          if (simpleMode) {
            finalResults.push({
              query: { title, artist },
              strict: true,
              result: {
                id: best.id ?? null,
                title: best.title ?? null,
                artist: best.artist?.name ?? null,
                bpm: best.tempo ?? null
              }
            });
          } else {
            finalResults.push({
              query: { title, artist },
              strict: true,
              data: { search: [best] }
            });
          }
        }
      } else {
        // NON-STRICT MODE
        if (simpleMode) {
          const mapped = results.map((item) => ({
            id: item.id ?? null,
            title: item.title ?? null,
            artist: item.artist?.name ?? null,
            bpm: item.tempo ?? null
          }));

          finalResults.push({
            query: { title, artist },
            strict: false,
            results: mapped
          });
        } else {
          finalResults.push({
            query: { title, artist },
            strict: false,
            data
          });
        }
      }

      // --------------------------------------------
      // *** SAFE DELAY: 750 ms after each API call ***
      // --------------------------------------------
      await delay(750);
    }

    // --------------------------------------------
    // RETURN MULTI-SONG RESULT
    // --------------------------------------------
    return new Response(
      JSON.stringify({ results: finalResults }, null, 2),
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
