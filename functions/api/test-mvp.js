export async function onRequest(context) {
    const debug = [];

    debug.push("Function invoked");

    // EINZIG korrekter Zugriff
    const apiKey = context.env.GETSONGBPM_API_KEY;
    debug.push("API key loaded: " + (apiKey ? "yes" : "no"));

    if (!apiKey) {
        return new Response(
            JSON.stringify({ error: "Missing API key", debug }),
            { headers: { "Content-Type": "application/json" } }
        );
    }

    // Ultra-MVP – ein harter Test-Lookup ohne Parameter
    const lookup = "song:Shape+of+You artist:Ed+Sheeran";

    const url =
        "https://api.getsongbpm.com/search/?api_key=" +
        apiKey +
        "&type=both&lookup=" +
        lookup;

    debug.push("URL: " + url);

    let response;
    try {
        response = await fetch(url, {
            headers: {
                "User-Agent": "Mozilla/5.0",
            },
        });
        debug.push("Fetch status: " + response.status);
    } catch (err) {
        debug.push("Fetch error: " + err.message);
        return new Response(JSON.stringify({ error: "Fetch failed", debug }), {
            headers: { "Content-Type": "application/json" },
        });
    }

    let data;
    try {
        data = await response.json();
    } catch (err) {
        const text = await response.text();
        debug.push("JSON parse failed, preview: " + text.substring(0, 300));

        return new Response(
            JSON.stringify({
                error: "Non-JSON returned",
                preview: text.substring(0, 300),
                debug,
            }),
            { headers: { "Content-Type": "application/json" } }
        );
    }

    return new Response(JSON.stringify({ debug, data }), {
        headers: { "Content-Type": "application/json" },
    });
}
