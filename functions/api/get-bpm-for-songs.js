export default {
  async fetch(request, context) {
    try {
      const url = new URL(request.url);
      const q = url.searchParams.get("q");
      const simple = url.searchParams.get("simple") === "1";
      const strict = url.searchParams.get("strict") === "1";

      if (!q) {
        return new Response(JSON.stringify({ error: "Missing q parameter" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      // ✔ korrekter API-Key-Zugriff (laut Projektbasis!)
      const apiKey = context.env.GETSONGBPM_API_KEY;

      const items = q.split(";").map(entry => {
        const [title, artist] = entry.split("|").map(s => s?.trim() || "");
        return { title, artist };
      });

      const results = [];

      for (const item of items) {
        const lookup = `song:${encodeURIComponent(item.title)} artist:${encodeURIComponent(item.artist)}`;

        // API URL (Key in Query, NICHT im Header)
        const apiUrl = `https://api.getsongbpm.com/search/?api_key=${apiKey}&type=both&lookup=${lookup}`;

        let json;
        try {
          const resp = await fetch(apiUrl, {
            headers: { "User-Agent": "Mozilla/5.0" }
          });

          const text = await resp.text();

          if (text.startsWith("<!DOCTYPE html>")) {
            // Captcha → wir geben ein Null-Ergebnis zurück
            results.push({
              query: item,
              strict,
              result: null
            });
            continue;
          }

          json = JSON.parse(text);

        } catch (err) {
          results.push({
            query: item,
            strict,
            result: null
          });
          continue;
        }

        const search = json?.search || [];

        // -----------------------------------------
        // STRICT MODE  (exakte Übereinstimmung)
        // -----------------------------------------
        if (strict) {
          const normalizedTitle = item.title.toLowerCase();
          const normalizedArtist = item.artist.toLowerCase();

          const matches = search.filter(s =>
            (s.title || "").trim().toLowerCase() === normalizedTitle &&
            (s.artist?.name || "").trim().toLowerCase() === normalizedArtist
          );

          if (matches.length === 0) {
            results.push({
              query: item,
              strict: true,
              result: null
            });
            continue;
          }

          // Falls mehrere exakt matchen → frühestes Jahr wählen
          const best =
            matches.length === 1
              ? matches[0]
              : matches.reduce((a, b) =>
                  ((a.album?.year || 9999) < (b.album?.year || 9999) ? a : b)
                );

          const formatted = {
            id: best.id,
            title: best.title,
            artist: best.artist?.name,
            bpm: best.tempo
          };

          results.push({
            query: item,
            strict: true,
            result: simple ? formatted : best
          });

          continue;
        }

        // -----------------------------------------
        // NON-STRICT MODE
        // -----------------------------------------
        if (simple) {
          if (!search.length) {
            results.push({
              query: item,
              strict: false,
              result: null
            });
            continue;
          }

          const s = search[0];

          results.push({
            query: item,
            strict: false,
            result: {
              id: s.id,
              title: s.title,
              artist: s.artist?.name,
              bpm: s.tempo
            }
          });
        } else {
          results.push({
            query: item,
            strict: false,
            result: search
          });
        }
      }

      return new Response(JSON.stringify({ results }, null, 2), {
        headers: { "Content-Type": "application/json" }
      });

    } catch (err) {
      return new Response(JSON.stringify({
        error: "Unhandled exception",
        message: err.message
      }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }
  }
};
