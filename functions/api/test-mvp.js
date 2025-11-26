export async function onRequest(context) {
  const debug = [];

  try {
    debug.push("Function invoked");

    const apiKey = context.env.GETSONGBPM_API_KEY;
    debug.push("API key present: " + (apiKey ? "yes" : "no"));

    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "Missing API key", debug }),
        { headers: { "Content-Type": "application/json" } }
      );
    }

    // exakt wie im funktionierenden Browser-Request:
    const lookup = "song:Shape+of+You artist:Ed+Sheeran";

    const url =
      "https://api.getsong.co/search/?" +
      "api_key=" + apiKey +
      "&type=both" +
      "&lookup=" + lookup;

    debug.push("URL: " + url);

    let response;
    try {
      response = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0",
        },
      });
      debug.push("Fetch status: " + response.status);
      debug.push("Content-Type: " + response.headers.get("Content-Type"));
    } catch (err) {
      debug.push("Fetch error: " + err.message);
      return new Response(
        JSON.stringify({ error: "Fetch failed", debug }),
        { headers: { "Content-Type": "application/json" } }
      );
    }

    const text = await response.text();
    debug.push("Response length: " + text.length);

    try {
      const data = JSON.parse(text);
      return new Response(
        JSON.stringify({ debug, data }, null, 2),
        { headers: { "Content-Type": "application/json" } }
      );
    } catch (err) {
      debug.push("JSON parse error: " + err.message);
      return new Response(
        JSON.stringify({
          error: "Response was not JSON",
          preview: text.substring(0, 300),
          debug,
        }),
        { headers: { "Content-Type": "application/json" } }
      );
    }
  } catch (outerErr) {
    debug.push("Outer error: " + outerErr.message);
    return new Response(
      JSON.stringify({ error: "Unhandled exception", debug }),
      { headers: { "Content-Type": "application/json" } }
    );
  }
}
