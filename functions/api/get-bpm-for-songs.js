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
        debug.push({
          step: "missing_q",
          message: "Missing q parameter",
        });

        return new Response(
          JSON.stringify({
            error: "Missing q parameter",
            debug: debug,
          }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      // 🔒 EINZIG KORREKTER ZUGRIFF AUF DEN API-KEY
      const apiKey = context.env.GETSONGBPM_API_KEY;

      if (!apiKey) {
        debug.push({
          step: "missing_api_key",
          message: "context.env.GETSONGBPM_API_KEY is not defined or empty",
        });

        return new Response(
          JSON.stringify({
            error: "API key not configured",
            debug: debug,
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
        rawPairs: rawPairs,
      });

      const songs = rawPairs
        .map((pair) => {
          const parts = pair.split("|");
          const title = parts[0] ? parts[0].trim() : "";
          const artist = parts[1] ? parts[1].trim() : "";

          return {
            raw: pair,
            title: title,
            artist: artist,
          };
        })
        .filter((song) => song.title && song.artist);

      debug.push({
        step: "parsed_songs",
        message: "Parsed songs from q",
        songs: songs,
      });

      if (songs.length === 0) {
        debug.push({
          step: "no_valid_songs",
          message:
            "No valid song|artist pairs found. Expected: Title|Artist;Title2|Artist2",
        });

        return new Response(
          JSON.stringify({
            error: "No valid song|artist pairs in q",
            debug: debug,
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
          raw: song.raw,
          title: song.title,
          artist: song.artist,
        };

        try {
          // 🎯 Lookup wie im Browser:
          // - KEIN encodeURIComponent
          // - Leerzeichen → "+"
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
            message: "About to call GetSongBPM",
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
            message: "Received response from GetSongBPM",
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
              message: "Failed to parse JSON, got non-JSON response",
              song: perSongDebug,
            });

            results.push({
              title: song.title,
              artist: song.artist,
              debug: perSongDebug,
              result: {
                error: "API returned non-JSON response",
                preview: perSongDebug.preview,
              },
            });

            continue;
          }

          if (data && typeof data === "object" && data.error) {
            perSongDebug.apiError = data.error;

            debug.push({
              step: "api_error",
              message: "GetSongBPM returned error in payload",
              song: perSongDebug,
            });
          }

          results.push({
            title: song.title,
            artist: song.artist,
            debug: perSongDebug,
            result: data,
          });
        } catch (innerErr) {
          perSongDebug.catchError = innerErr.message;

          debug.push({
            step: "inner_catch",
            message: "Unhandled error during per-song processing",
            song: perSongDebug,
          });

          results.push({
            title: song.title,
            artist: song.artist,
            debug: perSongDebug,
            result: {
              error: "Unhandled error during song processing",
              details: innerErr.message,
            },
          });
        }
      }

      debug.push({
        step: "done",
        message: "Finished processing all songs",
        songCount: results.length,
      });

      return new Response(
        JSON.stringify({
          results: results,
          debug: debug,
        }),
        {
          headers: { "Content-Type": "application/json" },
        }
      );
    } catch (err) {
      debug.push({
        step: "outer_catch",
        message: "Unhandled top-level exception",
        error: err.message,
      });

      return new Response(
        JSON.stringify({
          error: "Unhandled exception",
          details: err.message,
          debug: debug,
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }
  },
};
