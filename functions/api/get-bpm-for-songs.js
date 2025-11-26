export default {
  async fetch(request, context) {
    const debug = [];

    try {
      debug.push("Function invoked");

      // 🔒 Korrekt laut Projektbasis
      const apiKey = context.env.GETSONGBPM_API_KEY;
      debug.push("API key present: " + (apiKey ? "yes" : "no"));

      const { searchParams } = new URL(request.url);
      const q = searchParams.get("q");

      if (!q) {
        debug.push("Missing q parameter");
        return new Response(
          JSON.stringify({ error: "Missing q parameter", debug }, null, 2),
          { headers: { "Content-Type": "application/json" } }
        );
      }

      debug.push("Raw q: " + q);

      const songs = q.split(";").map((pair) => {
        const [title, artist] = pair.split("|").map(s => s.trim());
        return { title, artist };
      });

      const results = [];

      for (const song of songs) {
        if (!song.title || !song.artist) {
          results.push({
            ...song,
            error: "Invalid format (expected Title|Artist)"
          });
          continue;
        }

        const lookup =
          "song:" +
          encodeURIComponent(song.title) +
          " artist:" +
          encodeURIComponent(song.artist);

        const url =
          "https://api.getsong.co/search/?" +
          "api_key=" + apiKey +
          "&type=both" +
          "&lookup=" + lookup;

        debug.push("Requesting: " + url);

        let resp;
        try {
          resp = await fetch(url, {
            headers: {
              "User-Agent": "Mozilla/5.0"
            }
          });
        } catch (ex) {
          results.push({
            ...song,
            error: "Fetch failed",
            details: ex.message
          });
          continue;
        }

        const text = await resp.text();

        if (!resp.headers.get("Content-Type")?.includes("application/json")) {
          results.push({
            ...song,
            error: "Non-JSON received",
            preview: text.substring(0, 300)
          });
          continue;
        }

        try {
          const json = JSON.parse(text);
          results.push({ ...song, result: json });
        } catch (err) {
          results.push({
            ...song,
            error: "JSON parse failed",
            details: err.message,
            preview: text.substring(0, 300)
          });
        }
      }

      return new Response(
        JSON.stringify({ debug, results }, null, 2),
        { headers: { "Content-Type": "application/json" } }
      );

    } catch (err) {
      debug.push("Unhandled exception: " + err.message);
      return new Response(
        JSON.stringify({ error: "Unhandled exception", debug }),
        { headers: { "Content-Type": "application/json" } }
      );
    }
  }
};
