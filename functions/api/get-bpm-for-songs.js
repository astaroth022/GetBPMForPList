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
        q,
      });

      if (!q) {
        debug.push({ step: "missing_q", message: "Missing q parameter" });
        return new Response(
          JSON.stringify({ error: "Missing q parameter", debug }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      // ❗ EINZIG KORREKTER ZUGRIFF — Projektregel
      const apiKey = context.env.GETSONGBPM_API_KEY;

      if (!apiKey) {
        debug.push({
          step: "missing_api_key",
          message: "context.env.GETSONGBPM_API_KEY is not defined",
        });

        return new Response(
          JSON.stringify({
            error: "API key not configured",
            debug,
          }),
          {
            status: 500,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      const rawPairs = q.split(";");
      debug.push({
        step: "split_songs",
        message: "Split q into song|artist pairs",
        rawPairs,
      });

      const songs = rawPairs
        .map((pair) => {
          const [titleRaw, artistRaw] = pair.split("|");
          return {
            title: titleRaw?.trim() ?? "",
            artist: artistRaw?.trim() ?? "",
            raw: pair,
          };
        })
        .filter((s) => s.title && s.artist);

      debug.push({
        step: "parsed_songs",
        message: "Parsed songs",
        songs,
      });

      if (songs.length === 0) {
        debug.push({ step: "no_valid_songs", message: "No valid song|artist pairs" });
        return new Response(
          JSON.stringify({ error: "No valid song|artist pairs", debug }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      const results = [];

      for (const song of songs) {
        const perSongDebug = {
          raw: song.raw,
          title: song.title,
          artist: song.artist,
        };

        try {
          // 🎯 Browser-kompatibles Lookup → KEIN encodeURIComponent
          const titleLookup = song.title.replace(/ /g, "+");
          const artistLookup = song.artist.replace(/ /g, "+");

          const lookup = `song:${titleLookup} artist:${artistLookup}`;
          perSongDebug.lookup = lookup;

          const apiUrl = `https://api.getsongbpm.com/search/?api_key=${apiKey}&type=both&lookup=${lookup}`;
          perSongDebug.apiUrl = apiUrl;

          debug.push({
            step: "before_fetch",
            message: "Calling GetSongBPM",
            song: perSongDebug,
          });

          const response = await fetch(apiUrl, {
            headers: { "User-Agent": "Mozilla/5.0" },
          });

          perSongDebug.status = response.status;
          perSongDebug.ok = response.ok;
          perSongDebug.contentType = response.headers.get("Content-Type");

          debug.push({
            step: "after_fetch",
            message: "Got response",
            song: perSongDebug,
          });

          let data;
          try {
            data = await response.json();
          } catch (e) {
            const text = await response.text();

            perSongDebug.jsonError = e.message;
            perSongDebug.preview = text.substring(0, 300);

            debug.push({
              step: "json_parse_error",
              message: "Response was not JSON",
              song: perSongDebug,
            });

            results.push({
              ...song,
              debug: perSongDebug,
              result: { error: "API returned non-JSON", preview: perSongDebug.preview },
            });

            continue;
          }

          if (data.error) {
            perSongDebug.apiError = data.error;

            debug.push({
              step: "api_error",
              message: "API returned error",
              song: perSongDebug,
            });
          }

          results.push({ ...song, debug: perSongDebug, result: data });
        } catch (innerErr) {
          perSongDebug.catchError = innerErr.message;

          debug.push({
            step: "inner_catch",
            message: "Error while processing song",
            song: perSongDebug,
          });

          results.push({
            ...song,
            debug: perSongDebug,
            result: {
              error: "Unhandled error",
              details: innerErr.message,
            },
          });
        }
      }

      debug.push({
        step: "done",
        message: "Finished processing all songs",
        count: results.length,
      });

      return new Response(
        JSON.stringify({ results, debug }),
        { headers: { "Content-Type": "application/json" } }
      );
    } catch (err) {
      debug.push({
        step: "outer_catch",
        message: "Unhandled top-level error",
        error: err.message,
      });

      return new Response(
        JSON.stringify({ error: "Unhandled exception", debug }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }
  },
};
