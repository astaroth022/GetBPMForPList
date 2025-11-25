export async function onRequest(context) {
    try {
        const apiKey = context.env.GETSONGBPM_API_KEY;
        if (!apiKey) {
            return new Response(JSON.stringify({
                error: "API key missing",
                details: "GETSONGBPM_API_KEY not available in context.env"
            }), { status: 500, headers: { "Content-Type": "application/json" } });
        }

        // Query-Parameter "q" holen
        const { searchParams } = new URL(context.request.url);
        const q = searchParams.get("q");

        if (!q) {
            return new Response(JSON.stringify({ error: "Missing parameter q" }), {
                status: 400,
                headers: { "Content-Type": "application/json" }
            });
        }

        // Beispiel: q="Shape of You|Ed Sheeran"
        const [title, artist] = q.split("|").map(s => s.trim());

        if (!title || !artist) {
            return new Response(JSON.stringify({
                error: "Invalid q format",
                expected: "title|artist"
            }), {
                status: 400,
                headers: { "Content-Type": "application/json" }
            });
        }

        // API-URL exakt wie im Browser-Test:
        const apiUrl =
            `https://api.getsongbpm.com/search/?type=both&lookup=song:${encodeURIComponent(title)} artist:${encodeURIComponent(artist)}`;

        // Fetch mit verpflichtendem Header
        const response = await fetch(apiUrl, {
            headers: {
                "X-API-KEY": apiKey
            }
        });

        // API antwortet nicht immer JSON → versuchen wir sauber zu parsen
        const text = await response.text();

        let json;
        try {
            json = JSON.parse(text);
        } catch {
            return new Response(JSON.stringify({
                error: "API returned non-JSON",
                preview: text.substring(0, 200)
            }), {
                status: 502,
                headers: { "Content-Type": "application/json" }
            });
        }

        return new Response(JSON.stringify({
            title,
            artist,
            result: json
        }), {
            status: 200,
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
