export async function onRequest(context) {
    try {
        const url = new URL(context.request.url);
        const q = url.searchParams.get("q");

        if (!q) {
            return Response.json({ error: "Missing q parameter" });
        }

        // *** KORREKTE ART für Pages Functions ***
        const apiKey = context.env.GETSONGBPM_API_KEY;

        if (!apiKey) {
            return Response.json({
                error: "Server misconfiguration: GETSONGBPM_API_KEY is not set."
            });
        }

        // Format:  "Title|Artist,Title|Artist"
        const pairs = q.split(",").map(entry => {
            const [title, artist] = entry.split("|").map(x => x?.trim());
            return { title, artist };
        });

        const results = [];

        for (const { title, artist } of pairs) {
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

            const raw = await response.text();

            let data;
            try {
                data = JSON.parse(raw);
            } catch {
                results.push({
                    title,
                    artist,
                    error: "API returned HTML instead of JSON",
                    preview: raw.slice(0, 200)
                });
                continue;
            }

            results.push({
                title,
                artist,
                result: data
            });

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
