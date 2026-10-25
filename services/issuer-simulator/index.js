import http from "node:http";
const port = Number(process.env.PORT ?? 4003);
const server = http.createServer(async (req, res) => {
  res.setHeader("content-type", "application/json");
  if (req.method === "GET" && req.url === "/health") {
    res.writeHead(200); return res.end(JSON.stringify({status:"UP",service:"issuer-simulator"}));
  }
  if (req.method === "POST" && req.url === "/authorize") {
    let body = "";
    for await (const chunk of req) body += chunk;
    let input;
    try { input = JSON.parse(body); } catch { res.writeHead(400); return res.end(JSON.stringify({error:"invalid JSON"})); }
    // Test-only instruction; no real bank or card network is contacted.
    const declined = input.scenario === "decline";
    res.writeHead(200);
    return res.end(JSON.stringify({
      status: declined ? "DECLINED" : "APPROVED",
      issuerId: "issuer-simulator-001",
      reason: declined ? "issuer-test-rule-decline" : "issuer-test-rule-approved"
    }));
  }
  res.writeHead(404); res.end(JSON.stringify({error:"not found"}));
});
server.listen(port, "0.0.0.0", () => console.log(`issuer simulator listening on ${port}`));
