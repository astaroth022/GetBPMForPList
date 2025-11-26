export default {
  async fetch(request, context) {
    const debug = [];

    try {
      debug.push({ step: "start", message: "Function invoked" });

      const urlObj = new URL(request.url);
      const q = urlObj.searchParams.get("q");

      debug.push({
        step: "parse_query",
        message: "Parsed query parameters",
        requestUrl: urlObj.toString(),
        q: q,
      });

      if (!q) {
        debug.push({ step: "missing_q", message: "Missing q parameter" });

        return new Response(
          JSON.stringify({ error: "Missing q parameter", debug }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      // 🔒 Einzig korrekter Zugriff
      const apiKey = context.env.GETSONGBPM_API_KEY;

      if (!apiKey) {
        debug.push({
          step: "missing_api_key",
          message: "context.env.GETSONGBPM_API_KEY is missing",
        });

        return new Response(
          JSON.stringify({ error: "API key missing", debug }),
          {
            status: 500,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      const rawPairs = q.split(";");
      debug.push({
        step: "split_songs",
        rawPairs,
      });

      const songs = rawPairs
        .map((pair) => {
          const parts = pair.split("|");
          return {
            raw: pair,
            title: parts[0]?.trim() ?? "",
            artist: parts[1]?.trim() ?? "",
          };
        })
        .filter((s) => s.title && s.artist);

      debug.push({
        step: "parsed_songs",
        songs,
      });

      if (songs.length === 0) {
        return new Response(
          JSON.stringify({
            error: "No valid song|artist pairs",
            debug,
          }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      const results = [];

      for (const song of songs) {
        const perSongDebug = {
          title: song.title,
          artist: song.artist,
          raw: song.raw,
        };

        try {
          const titleLookup = song.title.replace(/ /g, "+");
          const artistLookup = song.artist.replace(/ /g, "+");
          const lookup = `song:${titleLookup} artist:${artistLookup}`;

          perSongDebug.lookup = lookup;

          const apiUrl =
            `https://api.getsongbpm.com/search/?api_key=` +
            apiKey +
            `&type=both&lookup=` +
            lookup;

          perSongDebug.apiUrl = apiUrl;

          debug.push({
            step: "before_fetch",
            song: perSongDebug,
          });

          const response = await fetch(apiUrl, {
            headers: {
              "User-Agent": "Mozilla/5.0",
            },
          });

          perSongDebug.status = response.status;
          perSongDebug.ok = response.ok;
          perSongDebug.contentType = response.headers.get("Content-Type");

          debug.push({
            step: "after_fetch",
            song: perSongDebug,
          });

          let data;

          try {
            data = await response.json();
          } catch (err) {
            const text = await response.text();

            perSongDebug.jsonError = err.message;
            perSongDebug.preview = text.substring(0, 300);

            debug.push({
              step: "json_parse_error",
              song: perSongDebug,
            });

            results.push({
              ...song,
              debug: perSongDebug,
              result: {
                error: "API returned non-JSON",
                preview: perSongDebug.preview,
              },
            });

            continue;
          }

          if (data.error) {
            perSongDebug.apiError = data.error;
          }

          results.push({
            ...song,
            debug: perSongDebug,
            result: data,
          });
        } catch (err) {
          perSongDebug.catchError = err.message;

          debug.push({
            step: "inner_catch",
            song: perSongDebug,
          });

          results.push({
            ...song,
            debug: perSongDebug,
            result: {
              error: "Unhandled error",
              details: err.message,
            },
          });
        }
      }

      debug.push({ step: "done", songs: results.length });

      return new Response(JSON.stringify({ results, debug }), {
        headers: { "Content-Type": "application/json" },
      });
    } catch (err) {
      debug.push({ step: "outer_catch", error: err.message });

      return new Response(
        JSON.stringify({
          error: "Unhandled exception",
          details: err.message,
          debug,
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }
  },
};
