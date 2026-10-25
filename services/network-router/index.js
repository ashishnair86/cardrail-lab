import http from "node:http";
const port = Number(process.env.PORT ?? 4002);
const issuerUrl = process.env.ISSUER_URL ?? "http://localhost:4003";
const server = http.createServer(async (req, res) => {
  res.setHeader("content-type", "application/json");
  if (req.method === "GET" && req.url === "/health") {
    res.writeHead(200); return res.end(JSON.stringify({status:"UP",service:"network-router"}));
  }
  if (req.method === "POST" && req.url === "/authorize") {
    let body = "";
    for await (const chunk of req) body += chunk;
    try {
      const request = JSON.parse(body);
      const response = await fetch(`${issuerUrl}/authorize`, {
        method:"POST", headers:{"content-type":"application/json"},
        body:JSON.stringify(request), signal:AbortSignal.timeout(3000)
      });
      if (!response.ok) throw new Error(`issuer returned ${response.status}`);
      const issuer = await response.json();
      res.writeHead(200);
      return res.end(JSON.stringify({
        status: issuer.status, reason: issuer.reason, issuerId: issuer.issuerId,
        route: "simulated-domestic-route-01", networkReference: `net-${request.paymentId}`
      }));
    } catch (error) {
      console.error("network authorization failed", error);
      res.writeHead(503); return res.end(JSON.stringify({error:"issuer unavailable"}));
    }
  }
  res.writeHead(404); res.end(JSON.stringify({error:"not found"}));
});
server.listen(port, "0.0.0.0", () => console.log(`network router listening on ${port}`));
