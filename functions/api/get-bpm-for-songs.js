export async function onRequest(context) {
    const { request, env } = context;

    const apiKey = env.GETSONGBPM_API_KEY;
    if (!apiKey) {
        return new Response(
            JSON.stringify({ error: "Server misconfiguration: GETSONGBPM_API_KEY is not set." }),
            { status: 500 }
        );
    }

    // Query-Parameter lesen
    const url = new URL(request.url);
    const titles = url.searchParams.getAll("titel");
    const artists = url.searchParams.getAll("interpret");

    if (titles.length === 0 || artists.length === 0 || titles.length !== artists.length) {
        return new Response(
            JSON.stringify({ error: "Missing or mismatched titel/interpret parameters." }),
            { status: 400 }
        );
    }

    // Mehrere Songs abfragen
    const results = [];

    for (let i = 0; i < titles.length; i++) {
        const title = encodeURIComponent(titles[i]);
        const artist = encodeURIComponent(artists[i]);

        const apiUrl =
            `https://api.getsongbpm.com/search/?api_key=${apiKey}&type=both&title=${title}&artist=${artist}`;

        const response = await fetch(apiUrl);
        const data = await response.json();

        results.push({
            titel: titles[i],
            interpret: artists[i],
            bpmResponse: data
        });

        // Sicherheitspause, um API-Limit zu schonen
        await new Promise(resolve => setTimeout(resolve, 300));
    }

    return new Response(JSON.stringify({ results }), {
        headers: { "Content-Type": "application/json" }
    });
}
