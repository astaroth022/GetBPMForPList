export async function onRequest(context) {
    const request = context.request;
    const apiKey = context.env.GETSONGBPM_API_KEY;

    if (!apiKey) {
        return new Response(JSON.stringify({
            error: "Missing environment variable GETSONGBPM_API_KEY",
            details: "Use context.env.GETSONGBPM_API_KEY in Cloudflare Pages Functions."
        }), { status: 500 });
    }

    const url = new URL(request.url);
    const q = url.searchParams.get("q");

    if (!q) {
        return new Response(JSON.stringify({
            error: "Missing query parameter q",
            example: "q=Shape of You|Ed Sheeran,Billie Jean|Michael Jackson"
        }), { status: 400 });
    }

    const pairs = q.split(",").map(pair => {
        const [title, artist] = pair.split("|");
        return {
            title: title?.trim() ?? "",
            artist: artist?.trim() ?? ""
        };
    });

    const results = [];

    for (const pair of pairs) {
        const lookup = encodeURIComponent(`${pair.title} ${pair.artist}`);
        const apiUrl =
            `https://api.getsongbpm.com/search/?api_key=${apiKey}&type=both&lookup=${lookup}`;

        try {
            // Browser spoofing header
            const response = await fetch(apiUrl, {
                method: "GET",
                headers: {
                    "User-Agent":
                        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
                        "(KHTML, like Gecko) Chrome/124.0 Safari/537.36",
                    "Accept": "application/json,text/html;q=0.9,*/*;q=0.8",
                    "Accept-Language": "en-US,en;q=0.9",
                    "Referer": "https://getsongbpm.com/",
                    "Origin": "https://getsongbpm.com",
                    "Cache-Control": "no-cache"
                }
            });

            const text = await response.text();

            let data;

            try {
                data = JSON.parse(text);
            } catch {
                results.push({
                    title: pair.title,
                    artist: pair.artist,
                    error: "API returned HTML instead of JSON (likely bot protection)",
                    preview: text.substring(0, 200)
                });
                continue;
            }

            results.push({
                title: pair.title,
                artist: pair.artist,
                result: data
            });

        } catch (err) {
            results.push({
                title: pair.title,
                artist: pair.artist,
                error: "Fetch failed",
                details: err.message
            });
        }

        // safe mode delay
        await new Promise(r => setTimeout(r, 300));
    }

    return new Response(JSON.stringify({ results }, null, 2), {
        headers: { "Content-Type": "application/json" }
    });
}
