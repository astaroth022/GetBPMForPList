export async function onRequest(context) {
  const debug = [];

  try {
    debug.push("Function invoked");

    // Einzig korrekter Zugriff auf den Key
    const apiKey = context.env.GETSONGBPM_API_KEY;

    if (!apiKey) {
      debug.push("API key missing (not shown)");
      return new Response(
        JSON.stringify({ error: "Missing API key", debug }, null, 2),
        { headers: { "Content-Type": "application/json" } }
      );
    }

    const urlObj = new URL(context.request.url);
    const q = urlObj.searchParams.get("q");
    const simpleMode = urlObj.searchParams.get("simple") === "1";

    debug.push("q: " + q);
    debug.push("simpleMode: " + simpleMode);

    let title = "Shape of You";
    let artist = "Ed Sheeran";

    if (!q) {
      debug.push("No q parameter, using default song");
    } else {
      const parts = q.split("|");
      const t = parts[0] ? parts[0].trim() : "";
      const a = parts[1] ? parts[1].trim() : "";

      if (!t || !a) {
        debug.push("Invalid q format, expected Title|Artist");
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
      debug.push(`Using song from q: ${title} | ${artist}`);
    }

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

    // API-Key NICHT loggen
    debug.push(
      "API URL (key hidden): https://api.getsong.co/search/?api_key=***&type=both&lookup=…"
    );

    let response;
    try {
      response = await fetch(apiUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0",
        },
      });
      debug.push("Fetch status: " + response.status);
      debug.push("Content-Type: " + response.headers.get("Content-Type"));
    } catch (err) {
      debug.push("Fetch error: " + err.message);
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
      debug.push("JSON parse error: " + err.message);
      return new Response(
        JSON.stringify(
          {
            error: "Response was not JSON",
            preview: text.substring(0, 300),
            debug,
          },
          null,
          2
        ),
        { headers: { "Content-Type": "application/json" } }
      );
    }

    // 🟢 Response-Aufbau
    const base = {
      query: { title, artist },
      debug,
    };

    if (simpleMode) {
      // Nur ID, Titel, Artist, BPM
      const arr = Array.isArray(data.search) ? data.search : [];
      const results = arr.map((item) => ({
        id: item.id ?? null,
        title: item.title ?? null,
        artist: item.artist?.name ?? null,
        bpm: item.tempo ?? null,
      }));

      return new Response(
        JSON.stringify({ ...base, results }, null, 2),
        { headers: { "Content-Type": "application/json" } }
      );
    } else {
      // Vollständige Originaldaten
      return new Response(
        JSON.stringify({ ...base, data }, null, 2),
        { headers: { "Content-Type": "application/json" } }
      );
    }

  } catch (err) {
    debug.push("Outer error: " + err.message);
    return new Response(
      JSON.stringify({ error: "Unhandled exception", debug }, null, 2),
      { headers: { "Content-Type": "application/json" } }
    );
  }
}
