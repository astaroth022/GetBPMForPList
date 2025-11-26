export async function onRequest(context) {
    const debug = [];

    try {
        debug.push("Function invoked");

        // API-Key Test
        const apiKey = context.env.GETSONGBPM_API_KEY;
        debug.push("API key present: " + (apiKey ? "yes" : "no"));

        if (!apiKey) {
            return new Response(JSON.stringify({ error: "No API key", debug }), {
                headers: { "Content-Type": "application/json" },
            });
        }

        // Hardcoded Lookup
        const lookup = "song:Shape+of+You artist:Ed+Sheeran";
        debug.push("Lookup: " + lookup);

        const url =
            "https://api.getsongbpm.com/search/?api_key=" +
            apiKey +
            "&type=both&lookup=" +
            lookup;

        debug.push("URL: " + url);

        // Do the fetch
        let response;
        try {
            response = await fetch(url, {
                headers: { "User-Agent": "Mozilla/5.0" },
            });
            debug.push("Fetch status: " + response.status);
        } catch (fetchErr) {
            debug.push("Fetch threw exception: " + fetchErr.message);
            return new Response(
                JSON.stringify({ error: "Fetch threw", debug }),
                { headers: { "Content-Type": "application/json" } }
            );
        }

        // Try parse JSON safely
        let text = await response.text();
        debug.push("Response text length: " + text.length);

        try {
            const data = JSON.parse(text);
            return new Response(
                JSON.stringify({ debug, data }, null, 2),
                { headers: { "Content-Type": "application/json" } }
            );
        } catch (jsonErr) {
            debug.push("JSON parse error: " + jsonErr.message);
            return new Response(
                JSON.stringify({
                    error: "Response was not JSON",
                    debug,
                    preview: text.substring(0, 300),
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
