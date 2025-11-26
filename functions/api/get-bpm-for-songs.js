export async function onRequest(context) {
    const apiKey = context.env.GETSONGBPM_API_KEY;

    if (!apiKey) {
        return new Response(
            JSON.stringify({ error: "Missing API key" }),
            { status: 500, headers: { "Content-Type": "application/json" } }
        );
    }

    // ?q=Song1|Artist1;Song2|Artist2;Song3|Artist3
    const q = context.request.url.split("?q=")[1];
    if (!q) {
        return new Response(
            JSON.stringify({ error: "Missing q parameter" }),
            { status: 400, headers: { "Content-Type": "application/json" } }
        );
    }

    const items = q.split(";").map(entry => {
        const [title, artist] = entry.split("|");
        return { title: title?.trim(), artist: artist?.trim() };
    });

    const results = [];

    for (const item of items) {
        if (!item.title || !item.artist) {
            results.push({
                title: item.title,
                artist: item.artist,
                error: "Invalid pair"
            });
            continue;
        }

        const lookup = `song:${encodeURIComponent(item.title)} artist:${encodeURIComponent(item.artist)}`;
        const url = `https://api.getsong.co/search/?api_key=${apiKey}&type=both&lookup=${lookup}`;

        try {
            const resp = await fetch(url, {
                cf: { cacheTtl: 5, cacheEverything: true }
            });

            const text = await resp.text();

            // API sometimes returns HTML captcha → detect it
            if (text.trim().startsWith("<!DOCTYPE html>")) {
                results.push({
                    title: item.title,
                    artist: item.artist,
                    error: "API returned HTML page (captcha?)",
                });
                continue;
            }

            const json = JSON.parse(text);

            results.push({
                title: item.title,
                artist: item.artist,
                result: json,
            });

        } catch (err) {
            results.push({
                title: item.title,
                artist: item.artist,
                error: "Request failed",
                details: err.toString()
            });
        }
    }

    return new Response(
        JSON.stringify({ results }, null, 2),
        { headers: { "Content-Type": "application/json" } }
    );
}
