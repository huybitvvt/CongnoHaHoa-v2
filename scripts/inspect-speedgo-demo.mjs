const base = "https://speedgo-os.web.app";
const email = process.env.SPEEDGO_EMAIL;
const password = process.env.SPEEDGO_PASSWORD;

if (!email || !password) {
  console.error("Missing SPEEDGO_EMAIL or SPEEDGO_PASSWORD.");
  process.exit(1);
}

async function fetchText(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url} HTTP ${response.status}`);
  return response.text();
}

function decodeFirestoreValue(value) {
  if (!value) return null;
  if (Object.prototype.hasOwnProperty.call(value, "stringValue")) return value.stringValue ?? "";
  if (Object.prototype.hasOwnProperty.call(value, "integerValue")) return Number(value.integerValue);
  if (Object.prototype.hasOwnProperty.call(value, "doubleValue")) return Number(value.doubleValue);
  if (Object.prototype.hasOwnProperty.call(value, "booleanValue")) return Boolean(value.booleanValue);
  if (Object.prototype.hasOwnProperty.call(value, "timestampValue")) return value.timestampValue ?? null;
  if (Object.prototype.hasOwnProperty.call(value, "nullValue")) return null;
  if (value.arrayValue) return (value.arrayValue.values || []).map(decodeFirestoreValue);
  if (value.mapValue) {
    return Object.fromEntries(Object.entries(value.mapValue.fields || {})
      .map(([key, item]) => [key, decodeFirestoreValue(item)]));
  }
  return null;
}

function redactShape(input) {
  if (!input || typeof input !== "object") return input;
  const output = {};
  for (const [key, value] of Object.entries(input)) {
    if (/email|phone|name|address/i.test(key)) output[key] = value ? "<redacted>" : value;
    else if (value && typeof value === "object" && !Array.isArray(value)) output[key] = redactShape(value);
    else output[key] = value;
  }
  return output;
}

function redactField(key, value) {
  return /email|phone|name|address/i.test(key) && value ? "<redacted>" : redactShape(value);
}

async function main() {
  const html = await fetchText(`${base}/admin/settlement/fulfillment-fees`);
  const scripts = [...new Set([...html.matchAll(/<script[^>]+src="([^"]+)"/g)]
    .map((match) => new URL(match[1], base).href))];
  const chunks = await Promise.all(scripts.map(async (src) => ({ src, body: await fetchText(src).catch(() => "") })));
  const bundle = chunks.map((chunk) => chunk.body).join("\n");

  const apiKey = bundle.match(/apiKey\s*:\s*"([^"]+)"/)?.[1]
    || bundle.match(/"apiKey"\s*:\s*"([^"]+)"/)?.[1];
  const projectId = bundle.match(/projectId\s*:\s*"([^"]+)"/)?.[1]
    || bundle.match(/"projectId"\s*:\s*"([^"]+)"/)?.[1]
    || "speedgo-os";
  const routes = [...new Set([...bundle.matchAll(/\/admin[A-Za-z0-9_/-]+/g)]
    .map((match) => match[0])
    .filter((route) => route.length < 80))]
    .sort();

  console.log(`HTML_OK scripts=${scripts.length} project=${projectId} apiKey=${apiKey ? "FOUND" : "MISSING"}`);
  console.log(`ROUTES ${routes.slice(0, 70).join(", ")}`);
  if (!apiKey) process.exit(2);

  const login = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${encodeURIComponent(apiKey)}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  });
  const auth = await login.json().catch(() => ({}));
  console.log(`LOGIN_HTTP ${login.status} localId=${auth.localId ? "FOUND" : "MISSING"} email=${auth.email || ""}`);
  if (!login.ok || !auth.idToken) process.exit(3);

  const root = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases/(default)/documents`;
  const headers = { Authorization: `Bearer ${auth.idToken}` };

  const collectionsResponse = await fetch(`${root}:listCollectionIds`, {
    method: "POST",
    headers: { ...headers, "content-type": "application/json" },
    body: JSON.stringify({ pageSize: 100 }),
  });
  const collectionsBody = await collectionsResponse.json().catch(() => ({}));
  const listedCollections = collectionsBody.collectionIds || [];
  console.log(`COLLECTION_IDS_HTTP ${collectionsResponse.status} ids=${listedCollections.join(",")}`);

  const wantedCollections = [...new Set([...listedCollections, "orders", "users"])];
  for (const collectionName of wantedCollections) {
    let count = 0;
    let pageToken = "";
    let sample = null;
    const fields = new Set();
    do {
      const params = new URLSearchParams({ pageSize: "300" });
      if (pageToken) params.set("pageToken", pageToken);
      const response = await fetch(`${root}/${encodeURIComponent(collectionName)}?${params}`, { headers });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        console.log(`COLLECTION ${collectionName} HTTP_${response.status}`);
        break;
      }
      for (const document of body.documents || []) {
        const row = Object.fromEntries(Object.entries(document.fields || {})
          .map(([key, value]) => [key, decodeFirestoreValue(value)]));
        Object.keys(row).forEach((key) => fields.add(key));
        sample ||= row;
        count++;
      }
      pageToken = body.nextPageToken || "";
    } while (pageToken && count < 5000);
    console.log(`COLLECTION ${collectionName} count=${count} fields=${[...fields].sort().slice(0, 80).join(",")}`);
    if (sample) {
      const shape = Object.fromEntries(["orderId", "sellerId", "status", "currency", "amountTotal", "createdAt", "fulfillment", "orderDetails", "role", "email", "fullName", "shopName"]
        .filter((key) => key in sample)
        .map((key) => [key, redactField(key, sample[key])]));
      console.log(`SAMPLE_SHAPE ${collectionName} ${JSON.stringify(shape).slice(0, 900)}`);
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
