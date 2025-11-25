export async function onRequest(context) {
    const { request, env } = context;

    try {
        const url = new URL(request.url);
        const q = url.searchParams.get("q");

        if (!q) {
            return Response.json({ error: "Missing q parameter" });
        }

        const apiKey = env.GETSONGBPM_API_KEY;
        if (!apiKey) {
            return Response.json({
                error: "Server misconfiguration: GETSONGBPM_API_KEY is not set."
            });
        }

        // Input-Format:  Title|Artist,Title|Artist
        const items = q.split(",").map(item => {
            const [title, artist] = item.split("|").map(v => v?.trim());
            return { title, artist };
        });

        const results = [];

        for (const { title, artist } of items) {
            if (!title || !artist) {
                results.push({
                    title,
                    artist,
                    error: "Invalid format – expected 'Title|Artist'"
                });
                continue;
            }

            const apiUrl =
                `https://api.getsongbpm.com/search/?api_key=${apiKey}` +
                `&type=both&title=${encodeURIComponent(title)}` +
                `&artist=${encodeURIComponent(artist)}`;

            const response = await fetch(apiUrl);

            let data;
            const text = await response.text();

            try {
                data = JSON.parse(text); // JSON erwartet
            } catch (err) {
                // HTML oder Fehlerseite → API hat geblockt
                results.push({
                    title,
                    artist,
                    error: "API returned non-JSON response",
                    raw: text.slice(0, 200)
                });
                continue;
            }

            results.push({
                title,
                artist,
                result: data
            });

            // Kurzes Delay (Rate-Limit schützen)
            await new Promise(r => setTimeout(r, 300));
        }

        return Response.json({ results });
    } catch (err) {
        return Response.json({
            error: "Unhandled exception",
            details: err.message
        });
    }
}
