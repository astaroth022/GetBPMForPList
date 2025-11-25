export async function onRequest(context) {
    try {
        const request = context.request;
        const url = new URL(request.url);
        const q = url.searchParams.get("q");

        if (!q) {
            return new Response(JSON.stringify({
                error: "Missing parameter 'q'",
                example: "q=Title|Artist,Title2|Artist2"
            }), {
                status: 400,
                headers: { "Content-Type": "application/json" }
            });
        }

        // *** DIE EINZIG RICHTIGE ZEILE BEI PAGES FUNCTIONS ***
        const apiKey = context.env.GETSONGBPM_API_KEY;

        if (!apiKey) {
            return new Response(JSON.stringify({
                error: "Env variable GETSONGBPM_API_KEY missing",
                notice: "context.env.GETSONGBPM_API_KEY did not return a value"
            }), {
                status: 500,
                headers: { "Content-Type": "application/json" }
            });
        }

        // Songs splitten
        const pairs = q.split(",").map(p => {
            const [title, artist] = p.split("|");
            return {
                title: title?.trim() ?? "",
                artist: artist?.trim() ?? ""
            };
        });

        const results = [];

        // Abfragen seriell mit Pause (Rate-Limit Safe)
        for (const song of pairs) {
            const lookup = encodeURIComponent(`${song.title} ${song.artist}`);
            const apiURL = `https://api.getsongbpm.com/search/?api_key=${apiKey}&type=both&lookup=${lookup}`;

            let apiResponse;

            try {
                const res = await fetch(apiURL);
                const text = await res.text();

                // Cloudflare-Block → HTML
                if (text.startsWith("<")) {
                    apiResponse = {
                        error: "API returned HTML instead of JSON",
                        preview: text.substring(0, 200)
                    };
                } else {
                    apiResponse = JSON.parse(text);
                }
            } catch (err) {
                apiResponse = { error: "Request failed", details: err.message };
            }

            results.push({
                title: song.title,
                artist: song.artist,
                result: apiResponse
            });

            // 300ms Delay
            await new Promise(res => setTimeout(res, 300));
        }

        return new Response(JSON.stringify({ results }, null, 2), {
            headers: { "Content-Type": "application/json" }
        });

    } catch (err) {
        return new Response(JSON.stringify({
            error: "Unhandled exception",
            details: err.message
        }), {
            status: 500,
            headers: { "Content-Type": "application/json" }
        });
    }
}
