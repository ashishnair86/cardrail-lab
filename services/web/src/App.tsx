import { useEffect, useState } from "react";

type Payment = {
  id: string;
  amount: number;
  currency: string;
  merchantId: string;
  status: "APPROVED" | "DECLINED";
  createdAt: string;
};

const apiBase = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000";

export default function App() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [amount, setAmount] = useState("125.00");
  const [scenario, setScenario] = useState<"approve" | "decline">("approve");
  const [message, setMessage] = useState("Connecting to the local payment API…");

  async function refresh() {
    try {
      const response = await fetch(`${apiBase}/api/payments`);
      if (!response.ok) throw new Error(`API returned ${response.status}`);
      const data = await response.json() as { items: Payment[] };
      setPayments(data.items);
      setMessage("Payment API connected");
    } catch {
      setMessage("API unavailable. Start the payment API on port 3000.");
    }
  }

  useEffect(() => { void refresh(); }, []);

  async function createPayment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      const response = await fetch(`${apiBase}/api/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: Number(amount), currency: "USD", merchantId: "merchant-demo", scenario })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Payment request failed");
      setMessage(`Synthetic payment ${data.status.toLowerCase()}`);
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Request failed");
    }
  }

  const approved = payments.filter(p => p.status === "APPROVED").length;
  const declined = payments.filter(p => p.status === "DECLINED").length;

  return <main className="shell">
    <header className="topbar">
      <div className="brand-mark">CR</div>
      <div><div className="eyebrow">PAYMENT PLATFORM LAB</div><h1>CardRail <span>Operations</span></h1></div>
      <div className="status"><i /> {message}</div>
    </header>
    <section className="intro">
      <div><p className="eyebrow">SANDBOX ENVIRONMENT</p><h2>Payment activity at a glance.</h2><p className="muted">Synthetic transactions only. This is a learning environment, not a real payment system.</p></div>
      <form className="create-card" onSubmit={createPayment}>
        <p className="eyebrow">CREATE TEST PAYMENT</p>
        <label>Amount (USD)<input type="number" min="0.01" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} required /></label>
        <label>Simulation scenario<select value={scenario} onChange={e => setScenario(e.target.value as "approve" | "decline")}><option value="approve">Approve</option><option value="decline">Decline</option></select></label>
        <button type="submit">＋ Create payment</button>
      </form>
    </section>
    <section className="metrics">
      <article><p className="eyebrow">TOTAL PAYMENTS</p><strong>{payments.length}</strong><span>In-memory demo records</span></article>
      <article><p className="eyebrow">APPROVED</p><strong>{approved}</strong><span>Simulated approvals</span></article>
      <article><p className="eyebrow">DECLINED</p><strong>{declined}</strong><span>Simulated declines</span></article>
    </section>
    <section className="table-card">
      <div className="table-head"><div><p className="eyebrow">TRANSACTION STREAM</p><h2>Recent payments</h2></div><button className="secondary" onClick={() => void refresh()}>Refresh</button></div>
      <div className="table-wrap"><table><thead><tr><th>PAYMENT ID</th><th>MERCHANT</th><th>AMOUNT</th><th>STATUS</th><th>CREATED</th></tr></thead>
        <tbody>{payments.length === 0 ? <tr><td colSpan={5} className="empty">No payments yet. Create a synthetic payment to begin.</td></tr> : payments.map(p => <tr key={p.id}><td className="mono">{p.id.slice(0, 8)}…</td><td>{p.merchantId}</td><td>{new Intl.NumberFormat("en-US", { style: "currency", currency: p.currency }).format(p.amount)}</td><td><span className={`pill ${p.status.toLowerCase()}`}>{p.status}</span></td><td>{new Date(p.createdAt).toLocaleString()}</td></tr>)}</tbody>
      </table></div>
    </section>
    <footer>CardRail Lab · Phase 1 · Frontend + Payment API</footer>
  </main>;
}
