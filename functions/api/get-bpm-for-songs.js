export async function onRequest(context, env) {
    try {
        const url = new URL(context.request.url);
        const params = url.searchParams;

        const apiKey = env.GETSONGBPM_API_KEY;
        if (!apiKey) {
            return new Response(JSON.stringify({
                error: "Server misconfiguration: GETSONGBPM_API_KEY is not set."
            }), { status: 500 });
        }

        // --- INPUT PARSING ---------------------------------------------------

        let queries = [];

        // Case 1: q=titel|interpret (kompakt)
        if (params.has("q")) {
            const raw = params.get("q").split(",");
            for (const pair of raw) {
                const [titel, interpret] = pair.split("|").map(v => v?.trim());
                if (titel && interpret) queries.push({ titel, interpret });
            }
        }

        // Case 2: einzelne titel & interpret
        if (params.has("titel") && params.has("interpret")) {
            queries.push({
                titel: params.get("titel").trim(),
                interpret: params.get("interpret").trim()
            });
        }

        if (queries.length === 0) {
            return new Response(JSON.stringify({
                error: "No valid query. Use ?titel=X&interpret=Y or ?q=Titel|Interpret"
            }), { status: 400 });
        }

        // --- API CALL FUNCTION -----------------------------------------------

        async function fetchBpmFor(titel, interpret) {
            const endpoint = `https://api.getsong.co/search/?song=${encodeURIComponent(titel)}&artist=${encodeURIComponent(interpret)}&api_key=${apiKey}`;

            const r = await fetch(endpoint);
            const data = await r.json();

            return {
                titel,
                interpret,
                apiResponse: data
            };
        }

        // --- RATE LIMIT PROTECTION ------------------------------------------

        let results = [];
        for (let i = 0; i < queries.length; i++) {
            const { titel, interpret } = queries[i];

            const result = await fetchBpmFor(titel, interpret);
            results.push(result);

            // Wait 250ms between requests → sehr konservativ, schützt zuverlässig
            if (i < queries.length - 1) {
                await new Promise(res => setTimeout(res, 250));
            }
        }

        // ---------------------------------------------------------------------

        return new Response(JSON.stringify({
            count: results.length,
            results
        }, null, 2), {
            headers: { "Content-Type": "application/json" }
        });

    } catch (err) {
        return new Response(JSON.stringify({
            error: "Unhandled exception",
            details: err.message
        }), { status: 500 });
    }
}
