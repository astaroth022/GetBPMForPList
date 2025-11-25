export async function onRequest(context) {
    const API_KEY = context.env.GETSONGBPM_API_KEY;

    if (!API_KEY) {
        return new Response(
            JSON.stringify({
                error: "Server misconfiguration",
                details: "GETSONGBPM_API_KEY is not set"
            }),
            { status: 500, headers: { "Content-Type": "application/json" } }
        );
    }

    try {
        const url = new URL(context.request.url);

        // Query parameters: ?q=Title1|Artist1,Title2|Artist2
        const raw = url.searchParams.get("q");
        if (!raw) {
            return new Response(JSON.stringify({ error: "Missing parameter q" }), {
                status: 400,
                headers: { "Content-Type": "application/json" }
            });
        }

        // Split multiple songs
        const entries = raw.split(",").map((s) => s.trim());

        const results = [];

        for (const entry of entries) {
            const [title, artist] = entry.split("|");

            if (!title || !artist) {
                results.push({
                    input: entry,
                    error: "Invalid format — use Title|Artist"
                });
                continue;
            }

            // Query GetSongBPM API
            const apiUrl = `https://api.getsongbpm.com/search/?api_key=${API_KEY}&type=song&lookup=${encodeURIComponent(title + " " + artist)}`;
            const apiResponse = await fetch(apiUrl);
            const data = await apiResponse.json();

            results.push({
                title,
                artist,
                apiResult: data
            });

            // Optional throttle: 200ms between queries to avoid API abuse
            await new Promise((r) => setTimeout(r, 200));
        }

        return new Response(JSON.stringify({ results }), {
            headers: { "Content-Type": "application/json" }
        });

    } catch (err) {
        return new Response(
            JSON.stringify({
                error: "Unhandled exception",
                details: err.message
            }),
            { status: 500, headers: { "Content-Type": "application/json" } }
        );
    }
}
