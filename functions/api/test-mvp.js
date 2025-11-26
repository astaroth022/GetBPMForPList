export async function onRequest(context) {
    const debug = [];

    try {
        debug.push("Function invoked");

        // API-Key aus Cloudflare (einzig korrekter Zugriff)
        const apiKey = context.env.GETSONGBPM_API_KEY;
        debug.push("API key loaded: " + (apiKey ? "yes" : "no"));

        if (!apiKey) {
            return new Response(JSON.stringify({ error: "No API key", debug }), {
                headers: { "Content-Type": "application/json" },
            });
        }

        // Test-Song (hart codiert)
        const lookup = "song:Shape+of+You artist:Ed+Sheeran";
        const url = "https://api.getsongbpm.com/search/?type=both&lookup=" + lookup;

        debug.push("Lookup: " + lookup);
        debug.push("URL (no key): " + url);

        let response;
        try {
            response = await fetch(url, {
                headers: {
                    "User-Agent": "Mozilla/5.0",
                    "X-API-KEY": apiKey,       // <<< THE FIX !!!
                },
            });

            debug.push("Fetch status: " + response.status);
            debug.push("Content-Type: " + response.headers.get("Content-Type"));
        } catch (err) {
            debug.push("Fetch crashed: " + err.message);
            return new Response(
                JSON.stringify({ error: "Fetch threw exception", debug }),
                { headers: { "Content-Type": "application/json" } }
            );
        }

        // Raw body
        const text = await response.text();
        debug.push("Response length: " + text.length);

        // Try JSON
        try {
            const json = JSON.parse(text);
            return new Response(JSON.stringify({ debug, json }, null, 2), {
                headers: { "Content-Type": "application/json" },
            });
        } catch (err) {
            debug.push("JSON parse failed: " + err.message);
            return new Response(
                JSON.stringify({
                    error: "Non-JSON received",
                    preview: text.substring(0, 300),
                    debug,
                }),
                { headers: { "Content-Type": "application/json" } }
            );
        }
    } catch (outerErr) {
        return new Response(
            JSON.stringify({
                error: "Unhandled exception",
                message: outerErr.message,
                debug,
            }),
            { headers: { "Content-Type": "application/json" } }
        );
    }
}
