// Silong Café kitchen dashboard. Reads/updates orders in MySQL through the Node API.
const API = "/api/admin/orders";
const $ = (id) => document.getElementById(id);
const peso = (n) => "₱" + n.toLocaleString();
const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c],
  );
const COLS = [
  ["new", "New orders"],
  ["preparing", "Brewing"],
  ["ready", "Ready"],
  ["done", "Finished"],
  ["cancelled", "Cancelled"],
];
const NEXT = {
  new: ["preparing", "Start brewing"],
  preparing: ["ready", "Mark ready"],
  ready: ["done", "Served"],
};
const ICON = { "Dine-in": "🪑", Takeout: "🥤", Pickup: "🛍" };

let data = [],
  seen = null,
  sound = true,
  showDone = false,
  demo = false,
  dragging = false,
  ctx;
let typeFilter = "",
  query = "";
const fresh = new Set();
let reportData = null;
let calendarMonth = null;
let activeSalesFilter = { type: "today", from: null, to: null };

/* ---------- helpers ---------- */
function beep() {
  if (!sound) return;
  try {
    ctx = ctx || new AudioContext();
    [880, 1175].forEach((f, i) => {
      const o = ctx.createOscillator(),
        g = ctx.createGain(),
        t = ctx.currentTime + i * 0.18;
      o.frequency.value = f;
      o.connect(g);
      g.connect(ctx.destination);
      g.gain.setValueAtTime(0.2, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
      o.start(t);
      o.stop(t + 0.3);
    });
  } catch (e) {}
}
function toast(msg) {
  const t = document.createElement("div");
  t.className = "toast";
  t.textContent = msg;
  $("toasts").appendChild(t);
  setTimeout(() => t.remove(), 5000);
}
const mins = (o) =>
  Math.max(0, Math.floor((Date.now() - new Date(o.created_at)) / 60000));
function age(o) {
  if (!NEXT[o.status]) return "";
  const m = mins(o),
    cls = m >= 10 ? "late" : m >= 5 ? "warn" : "";
  return `<span class="age ${cls}" title="Time since ordered">⏱ ${m < 1 ? "just now" : m + " min"}</span>`;
}
const match = (o) =>
  (!typeFilter || o.type === typeFilter) &&
  (!query ||
    [o.order_no, o.customer, o.phone, ...o.items.map((i) => i.name)]
      .join(" ")
      .toLowerCase()
      .includes(query));

/* ---------- render ---------- */
function card(o) {
  const n = NEXT[o.status];
  const payment = o.payment_method || "Cash";
  const receipt =
    payment !== "Cash" && o.receipt_url
      ? `<button class="receipt-badge" type="button" data-receipt="${esc(o.receipt_url)}">View Receipt</button>`
      : "";
  return `<article class="order ${fresh.has(o.id) ? "fresh" : ""}" draggable="true" data-open="${o.id}" style="--c:var(--${o.status === "new" ? "rust" : o.status === "preparing" ? "gold" : o.status === "ready" ? "ok" : o.status === "done" ? "line" : "late"})">
    <div class="hd"><span class="no">#${esc(o.order_no)}</span>${age(o)}</div>
    <div class="meta"><b>${esc(o.customer)}</b>${o.phone ? " · " + esc(o.phone) : ""}<br><span class="tag">${ICON[o.type] || ""} ${esc(o.type)}${o.table_no ? " · Table " + esc(o.table_no) : ""}</span><br><span class="payment-tag">${esc(payment)}${o.payment_provider ? " (" + esc(o.payment_provider) + ")" : ""}${o.reference_number ? " · Ref: " + esc(o.reference_number) : ""}</span></div>
    <ul>${o.items.map((i) => `<li><b>${i.qty}×</b> ${esc(i.name)} <small>${esc(i.variant)}${i.addons ? " + " + esc(i.addons) : ""}</small></li>`).join("")}</ul>
    ${o.notes ? `<div class="notes">📝 ${esc(o.notes)}</div>` : ""}
    <div class="total"><span>Total</span><span>${peso(o.total)}</span></div>
    ${n ? `<div class="acts"><button class="btn" data-id="${o.id}" data-s="${n[0]}">${n[1]}</button><button class="btn ghost" data-id="${o.id}" data-s="cancelled" title="Cancel order" aria-label="Cancel order">✕</button></div>` : ""}
    ${receipt}
  </article>`;
}

function draw() {
  if (dragging) return;
  const cols = showDone ? COLS : COLS.slice(0, 3);
  $("board").innerHTML = cols
    .map(([k, label]) => {
      const list = data
        .filter((o) => o.status === k && match(o))
        .sort((a, b) =>
          ["done", "cancelled"].includes(k) ? b.id - a.id : a.id - b.id,
        );
      return `<section class="col" data-s="${k}"><h2><span class="t">${label}</span><span class="n">${list.length}</span></h2>${list.map(card).join("") || '<div class="empty">Nothing here yet</div>'}</section>`;
    })
    .join("");

  const ok = data.filter((o) => o.status !== "cancelled");
  $("s-n").textContent = ok.length;
  const nw = data.filter((o) => o.status === "new").length;
  document.title = (nw ? `(${nw}) ` : "") + "Silong Café — Kitchen";
}

/* ---------- detail dialog ---------- */
function openDetail(id) {
  const o = data.find((x) => x.id == id);
  if (!o) return;
  const d = $("detail");
  d.innerHTML = `<div class="sheet"><div class="ticket-brand" aria-label="Silong Café"><svg viewBox="0 0 100 70" width="64" height="46" fill="none" stroke="#243326" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M6 40 50 4l44 36"/><path d="M38 28h24v8a12 12 0 0 1-24 0zM62 30h4a4 4 0 0 1 0 9h-4M50 24c-3-4 3-6 0-10"/></svg><div><b>SILONG CAFÉ</b><small>Kanlungan mula sa pagod.</small></div></div><div class="hd"><span class="no">#${esc(o.order_no)}</span>${age(o)}</div>
    <div class="meta"><b>${esc(o.customer)}</b>${o.phone ? " · " + esc(o.phone) : ""} · ${ICON[o.type] || ""} ${esc(o.type)}${o.table_no ? " · Table " + esc(o.table_no) : ""}<br>Ordered ${new Date(o.created_at).toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Manila" })}<br><b>Payment:</b> ${esc(o.payment_method || "Cash")}${o.reference_number ? " · Ref: " + esc(o.reference_number) : ""}${o.receipt_url ? ` · <button class="receipt-link" type="button" data-detail-receipt="${esc(o.receipt_url)}">View Receipt</button>` : ""}</div>
    <ul style="list-style:none;padding:0;margin:0">${o.items.map((i) => `<li style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px dashed var(--line)"><span><b>${i.qty}×</b> ${esc(i.name)}<small style="display:block;color:#7a5c48">${esc(i.variant)}${i.addons ? " + " + esc(i.addons) : ""}</small></span><span>${peso(i.qty * i.unit_price)}</span></li>`).join("")}</ul>
    ${o.notes ? `<div class="notes">📝 ${esc(o.notes)}</div>` : ""}
    <div class="total"><span>Total</span><span>${peso(o.total)}</span></div>
    <div class="steps" role="group" aria-label="Set status">${COLS.map(([k, l]) => `<button data-set="${k}" class="${o.status === k ? "on" : ""}">${l}</button>`).join("")}</div>
    <div class="acts" style="margin:0"><button class="btn" data-print>🖨 Print ticket</button><button class="btn ghost" data-close>Close</button></div></div>`;
  d.onclick = (e) => {
    const receipt = e.target.closest("[data-detail-receipt]");
    if (receipt) return openReceipt(receipt.dataset.detailReceipt);
    const b = e.target.closest("button");
    if (!b) {
      if (e.target === d) d.close();
      return;
    }
    if (b.dataset.set) {
      setStatus(o.id, b.dataset.set);
      d.close();
    } else if ("print" in b.dataset) printTicket(o);
    else if ("close" in b.dataset) d.close();
  };
  d.showModal();
}
function printTicket(o) {
  const w = window.open("", "_blank", "width=360,height=620");
  if (!w) return;
  const orderedAt = new Date(o.created_at).toLocaleString("en-PH", {
    timeZone: "Asia/Manila",
    dateStyle: "medium",
    timeStyle: "short",
  });
  const logo = `<svg viewBox="0 0 100 70" width="76" height="54" fill="none" stroke="#243326" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-label="Silong Café logo"><path d="M6 40 50 4l44 36"/><path d="M38 28h24v8a12 12 0 0 1-24 0zM62 30h4a4 4 0 0 1 0 9h-4M50 24c-3-4 3-6 0-10"/></svg>`;
  const paymentLabel = o.payment_method === "Cash"
    ? "Cash"
    : `${o.payment_method}${o.payment_provider ? ` (${o.payment_provider})` : ""}`;
  const paymentLine = o.payment_method === "Cash"
    ? "<b>Payment:</b> Cash"
    : `<b>Payment:</b> ${esc(paymentLabel)}${o.reference_number ? ` · <b>Ref #</b>${esc(o.reference_number)}` : ""}`;
  const items = o.items
    .map(
      (i) => `<tr><td class="qty">${i.qty}×</td><td><b>${esc(i.name)}</b><small>${esc(i.variant)}${i.addons ? " · " + esc(i.addons) : ""}</small></td><td class="amount">${peso(i.qty * i.unit_price)}</td></tr>`,
    )
    .join("");
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Silong Receipt #${esc(o.order_no)}</title><style>
    *{box-sizing:border-box}body{margin:0;background:#f6ead6;color:#4a3022;font:14px/1.35 Georgia,serif}.receipt{width:80mm;max-width:100%;margin:0 auto;background:#fffaf0;padding:10mm 7mm}.brand{text-align:center;border-bottom:2px solid #b8863b;padding-bottom:7px}.brand h1{margin:2px 0 0;font:700 24px Cinzel,Georgia,serif;letter-spacing:.18em}.brand p{margin:1px 0;color:#b8863b;font-size:12px}.tagline{font-family:'Kaushan Script',cursive;color:#c4703d}.order-head{display:flex;justify-content:space-between;align-items:end;padding:10px 0 6px}.order-head .number{font:700 24px Cinzel,Georgia,serif;color:#243326}.meta{font-size:12px;padding-bottom:8px;border-bottom:1px dashed #dcc9a6}.meta b{color:#243326}table{width:100%;border-collapse:collapse}td{padding:7px 0;border-bottom:1px dashed #dcc9a6;vertical-align:top}td.qty{width:28px;font-weight:bold;color:#243326}td.amount{text-align:right;width:58px;white-space:nowrap;font-weight:bold}td small{display:block;color:#7a5c48;font-size:11px}.notes{margin:8px 0;padding:7px;background:#fff1d6;border-radius:6px;font-size:12px}.total{display:flex;justify-content:space-between;align-items:center;padding:9px 0;font:700 18px Cinzel,Georgia,serif;color:#243326}.payment{font-size:12px;border-top:2px solid #b8863b;padding-top:7px}.footer{text-align:center;color:#7a5c48;font-size:11px;margin-top:12px}@media print{@page{size:80mm auto;margin:0}body{background:#fff}.receipt{padding:8mm 6mm;width:80mm}}
  </style></head><body><article class="receipt"><header class="brand">${logo}<h1>SILONG</h1><p>CAFÉ</p><div class="tagline">Kanlungan mula sa pagod.</div></header><div class="order-head"><div><div>ORDER</div><div class="number">#${esc(o.order_no)}</div></div><div class="meta">${esc(orderedAt)}</div></div><div class="meta"><b>${esc(o.customer)}</b>${o.phone ? " · " + esc(o.phone) : ""}<br>${esc(o.type)}${o.table_no ? " · Table " + esc(o.table_no) : ""}</div><table>${items}</table>${o.notes ? `<div class="notes"><b>Note:</b> ${esc(o.notes)}</div>` : ""}<div class="total"><span>TOTAL</span><span>${peso(o.total)}</span></div><div class="payment">${paymentLine}</div><footer class="footer">Thank you!<br>Made with care, served from the Silong.<br><b>Order Slip · Not an Official Receipt</b></footer></article></body></html>`);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 250);
}

/* ---------- data ---------- */
function detectNew() {
  const ids = data.map((o) => o.id);
  if (seen) {
    const added = data.filter((o) => !seen.has(o.id));
    if (added.length) {
      added.forEach((o) => {
        fresh.add(o.id);
        toast(`New order #${o.order_no} from ${o.customer}`);
      });
      beep();
      setTimeout(() => added.forEach((o) => fresh.delete(o.id)), 4000);
    }
  }
  seen = new Set(ids);
}
async function load() {
  if (!demo) {
    try {
      const r = await fetch(API);
      if (r.status === 401) {
        $("mode").textContent = "Login required";
        return;
      }
      if (!r.ok) throw 0;
      data = await r.json();
      $("mode").textContent = "● Live";
    } catch (e) {
      $("mode").textContent = "○ Offline, retrying…";
      return;
    }
  }
  detectNew();
  draw();
}
async function setStatus(id, status) {
  const o = data.find((x) => x.id == id);
  if (!o || o.status === status) return;
  if (status === "cancelled" && !confirm(`Cancel order #${o.order_no}?`))
    return;
  const prev = o.status;
  o.status = status;
  draw(); // optimistic update
  if (demo) return;
  try {
    const r = await fetch(`${API}/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (!r.ok) throw 0;
    loadSales();
  } catch (e) {
    o.status = prev;
    draw();
    toast("Could not update the order. Check the connection.");
  }
}

/* ---------- demo mode ---------- */
const SAMPLE = [
  [
    "Ana",
    "0917 555 0101",
    "Dine-in",
    "4",
    "Less ice please",
    [
      ["Silong Latte", "Iced", "Oat milk", 2, 199],
      ["Spanish Latte", "Hot", "", 1, 139],
    ],
  ],
  [
    "Mark",
    "",
    "Takeout",
    "",
    "",
    [["Strawberry Matcha", "Iced", "Whipped cream", 1, 179]],
  ],
  [
    "Bea",
    "0928 555 0199",
    "Pickup",
    "",
    "Pick up in 10 mins",
    [
      ["Chocolate Java Chip", "Milk base", "", 2, 159],
      ["Honey Peach Soda", "Iced", "", 1, 99],
    ],
  ],
  [
    "Joel",
    "",
    "Dine-in",
    "2",
    "",
    [
      ["Americano", "Iced", "Extra espresso shot", 2, 139],
      ["Yakap (Biscoff Latte)", "Iced", "", 1, 179],
    ],
  ],
];
let demoId = 0;
function addDemo(i = Math.floor(Math.random() * SAMPLE.length), ago = 0) {
  const [customer, phone, type, table_no, notes, items] = SAMPLE[i],
    id = ++demoId;
  data.push({
    id,
    order_no: String(id).padStart(3, "0"),
    customer,
    phone,
    type,
    table_no,
    notes,
    status: "new",
    created_at: new Date(Date.now() - ago * 60000).toISOString(),
    total: items.reduce((s, x) => s + x[3] * x[4], 0),
    items: items.map(([name, variant, addons, qty, unit_price]) => ({
      name,
      variant,
      addons,
      qty,
      unit_price,
    })),
  });
}
function startDemo() {
  if (demo) return;
  demo = true;
  $("mode").textContent = "Demo mode";
  $("sim").hidden = false;
  addDemo(0, 12);
  addDemo(1, 6);
  addDemo(2, 2);
  data[1].status = "preparing";
  data[2].status = "ready";
}

/* ---------- events ---------- */
$("snd").onclick = () => {
  sound = !sound;
  $("snd").textContent = sound ? "🔔 Sound on" : "🔕 Sound off";
  if (sound) beep();
};
$("hist").onclick = () => {
  showDone = !showDone;
  $("hist").textContent = showDone ? "Hide finished" : "Show finished";
  draw();
};
$("sim").onclick = () => {
  addDemo();
  detectNew();
  draw();
};
$("q").oninput = (e) => {
  query = e.target.value.trim().toLowerCase();
  draw();
};
$("types").onclick = (e) => {
  const b = e.target.closest(".chip");
  if (!b) return;
  typeFilter = b.dataset.t;
  document
    .querySelectorAll("#types .chip")
    .forEach((c) => c.classList.toggle("on", c === b));
  draw();
};
$("board").onclick = (e) => {
  const receipt = e.target.closest("[data-receipt]");
  if (receipt) return openReceipt(receipt.dataset.receipt);
  const b = e.target.closest("button[data-id]");
  if (b) return setStatus(b.dataset.id, b.dataset.s);
  const c = e.target.closest("[data-open]");
  if (c) openDetail(c.dataset.open);
};
// drag a ticket onto another column to change its status
$("board").addEventListener("dragstart", (e) => {
  const c = e.target.closest(".order");
  if (!c) return;
  dragging = true;
  c.classList.add("drag");
  e.dataTransfer.setData("text/plain", c.dataset.open);
});
$("board").addEventListener("dragend", () => {
  dragging = false;
  draw();
});
$("board").addEventListener("dragover", (e) => {
  const c = e.target.closest(".col");
  if (!c) return;
  e.preventDefault();
  document
    .querySelectorAll(".col")
    .forEach((x) => x.classList.toggle("over", x === c));
});
$("board").addEventListener("drop", (e) => {
  const c = e.target.closest(".col");
  if (!c) return;
  e.preventDefault();
  dragging = false;
  setStatus(e.dataTransfer.getData("text/plain"), c.dataset.s);
});
const tick = () => {
  $("clock").textContent = new Date().toLocaleTimeString("en-PH", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Manila",
  });
};
tick();
setInterval(tick, 15000);
load();
setInterval(load, 4000);
loadSales();
setInterval(loadSales, 60000);

/* ---------- receipt dialog ---------- */
function openReceipt(url) {
  $("receiptImage").src = url;
  $("receiptDlg").showModal();
}
$("closeReceipt").onclick = () => $("receiptDlg").close();

/* ---------- sales report ---------- */
function manilaDate() {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Manila",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date()).map((p) => [p.type, p.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}
function configureDateControls() {
  const today = manilaDate();
  $("sales-date").max = today;
  $("report-date").max = today;
}
async function loadRangeReport(from, to) {
  try {
    const r = await fetch(`/api/admin/sales?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&date=${encodeURIComponent(to)}`);
    if (!r.ok) throw 0;
    reportData = await r.json();
    $("report-sales").textContent = peso(reportData.sales);
    $("report-count").textContent = reportData.orderCount;
    $("report-cash").textContent = peso(reportData.cashSales);
    $("report-ewallet").textContent = peso(reportData.ewalletSales);
    $("report-bank").textContent = peso(reportData.bankSales);
    $("report-cash-count").textContent = `${reportData.cashOrders} orders`;
    $("report-ewallet-count").textContent = `${reportData.ewalletOrders} orders`;
    $("report-bank-count").textContent = `${reportData.bankOrders} orders`;
  } catch (_) {
    $("reportOrders").innerHTML = '<p class="meta">Could not load sales report.</p>';
  }
}
$("sales-date").value = manilaDate();
$("report-date").value = manilaDate();
$("sales-date-label").textContent = formatDateLabel(manilaDate());
$("report-date-label").textContent = formatDateLabel(manilaDate());
configureDateControls();
$("sales-date").onchange = null;
async function loadSales() {
  const date = $("sales-date").value || manilaDate();
  try {
    const r = await fetch(`/api/admin/sales?date=${encodeURIComponent(date)}`);
    if (!r.ok) throw 0;
    const s = await r.json();
    $("s-n").textContent = s.orderCount;
    $("s-s").textContent = peso(s.sales);
    $("cash-sales").textContent = peso(s.cashSales);
    $("ewallet-sales").textContent = peso(s.ewalletSales);
    $("bank-sales").textContent = peso(s.bankSales);
    $("ewallet-orders").textContent = `${s.ewalletOrders} orders`;
    $("bank-orders").textContent = `${s.bankOrders} orders`;
    $("top-title").textContent = date === manilaDate() ? "Top sellers today" : "Top sellers";
    $("top").innerHTML = s.topSellers.length
      ? s.topSellers.map((x) => `<div class="bar"><div><span>${esc(x.name)}</span><b>${x.quantity}</b></div><i style="width:${Math.max(8, x.quantity / s.topSellers[0].quantity * 100)}%"></i></div>`).join("")
      : '<p class="meta">No finished sales yet.</p>';
  } catch (_) {
    $("top").innerHTML = '<p class="meta">Could not load sales.</p>';
  }
}
async function openSalesReport() {
  $("report-date").value = $("sales-date").value || manilaDate();
  await loadReport($("report-date").value);
  $("salesDlg").showModal();
}

async function loadReport(date) {
  try {
    const r = await fetch(`/api/admin/sales?date=${encodeURIComponent(date)}`);
    if (!r.ok) throw 0;
    reportData = await r.json();
    $("report-sales").textContent = peso(reportData.sales);
    $("report-count").textContent = reportData.orderCount;
    $("report-cash").textContent = peso(reportData.cashSales);
    $("report-ewallet").textContent = peso(reportData.ewalletSales);
    $("report-bank").textContent = peso(reportData.bankSales);
    $("report-cash-count").textContent = `${reportData.cashOrders} orders`;
    $("report-ewallet-count").textContent = `${reportData.ewalletOrders} orders`;
    $("report-bank-count").textContent = `${reportData.bankOrders} orders`;

    $("reportOrders").innerHTML = reportData.orders.length
      ? reportData.orders
          .map((o) => {
            const items = o.items
              .map((i) => `${i.qty}× ${esc(i.name)} (${esc(i.variant)}${i.addons ? " · " + esc(i.addons) : ""})`)
              .join("<br>");
            const time = new Date(o.created_at).toLocaleTimeString("en-PH", {
              timeZone: "Asia/Manila",
              hour: "numeric",
              minute: "2-digit",
            });
            return `<article class="report-order"><div><b>#${esc(o.order_no)}</b><small>${esc(time)} · ${esc(o.customer)} · ${esc(o.type)}</small></div><div>${items}</div><div class="report-payment"><b>${esc(o.payment_method || "Cash")}</b>${o.reference_number ? `<small>Ref #${esc(o.reference_number)}</small>` : ""}</div><b>${peso(o.total)}</b></article>`;
          })
          .join("")
      : '<p class="meta">No finished orders for this date.</p>';

    $("auditGallery").innerHTML = reportData.receipts.length
      ? reportData.receipts
          .map((r) => `<button class="audit-card" type="button" data-audit-url="${esc(r.receiptUrl)}"><img src="${esc(r.receiptUrl)}" alt="Receipt for order #${esc(r.orderNo)}" /><div><b>#${esc(r.orderNo)}</b><span>Ref #${esc(r.referenceNumber || "—")}</span><strong>${peso(r.total)}</strong></div></button>`)
          .join("")
      : '<p class="meta">No digital receipts for this date.</p>';
  } catch (_) {
    $("reportOrders").innerHTML = '<p class="meta">Could not load sales report.</p>';
  }
}

function csvCell(value) {
  const text = String(value ?? "");
  return '"' + text.replaceAll('"', '""') + '"';
}

async function exportActiveSalesCsv() {
  const filter = activeSalesFilter.from
    ? activeSalesFilter
    : { type: "today", from: manilaDate(), to: manilaDate() };
  try {
    const r = await fetch(`/api/admin/sales?from=${encodeURIComponent(filter.from)}&to=${encodeURIComponent(filter.to)}&date=${encodeURIComponent(filter.to)}`);
    if (!r.ok) throw 0;
    downloadSalesCsv(await r.json(), filter);
  } catch (_) {
    toast("Could not prepare the CSV export.");
  }
}

function downloadSalesCsv(data, filter) {
  const headers = [
    "Order #", "Date & Time (Asia/Manila)", "Customer Name", "Order Type", "Items",
    "Payment Method", "Payment Provider", "Reference Number", "Total Amount",
  ];
  const rows = data.orders.map((o) => {
    const time = new Date(o.created_at).toLocaleString("en-PH", {
      timeZone: "Asia/Manila",
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
    const items = o.items
      .map((i) => `${i.qty}x ${i.name} (${i.variant}${i.addons ? " + " + i.addons : ""})`)
      .join("; ");
    return [
      o.order_no, time, o.customer, o.type, items,
      o.payment_method || "Cash", o.payment_provider || "", o.reference_number || "", o.total,
    ];
  });
  const csv = [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  const suffix = filter.from === filter.to ? filter.to : `${filter.from}-to-${filter.to}`;
  link.download = `silong-sales-${suffix}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

/* ---------- logout ---------- */
$("logout").onclick = async () => {
  await fetch("/api/admin/logout", { method: "POST" });
  window.location.href = "/";
};

$("salesCard").onclick = openSalesReport;
$("closeSales").onclick = () => $("salesDlg").close();
$("report-date").onchange = (e) => loadReport(e.target.value);
$("exportCsv").onclick = exportActiveSalesCsv;
$("sidebar-export-csv").onclick = exportActiveSalesCsv;
$("sidebar-view-receipts").onclick = async () => {
  await openSalesReport();
  document.querySelector('[data-report-tab="receipts"]')?.click();
};

document.querySelectorAll("[data-report-tab]").forEach((tab) => {
  tab.onclick = () => {
    document.querySelectorAll("[data-report-tab]").forEach((t) => t.classList.toggle("on", t === tab));
    const receipts = tab.dataset.reportTab === "receipts";
    $("salesSummary").hidden = receipts;
    $("receiptGallery").hidden = !receipts;
  };
});

$("auditGallery").onclick = (e) => {
  const card = e.target.closest("[data-audit-url]");
  if (card) openReceipt(card.dataset.auditUrl);
};

/* ---------- calendar ---------- */
function dateFromIso(iso) {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, month - 1, day, 12);
}

function shiftManilaDate(iso, days) {
  const date = dateFromIso(iso);
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function yesterdayDate() {
  return shiftManilaDate(manilaDate(), -1);
}

function formatDateLabel(iso) {
  return dateFromIso(iso).toLocaleDateString("en-PH", {
    timeZone: "Asia/Manila",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
function renderBrandedCalendar(kind) {
  const input = $(kind === "sales" ? "sales-date" : "report-date");
  const calendar = $(kind === "sales" ? "sales-calendar" : "report-calendar");
  const selected = input.value || manilaDate();
  const selectedDate = dateFromIso(selected);
  calendarMonth = calendarMonth || new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
  const year = calendarMonth.getFullYear();
  const month = calendarMonth.getMonth();
  const today = manilaDate();
  const monthName = new Date(year, month, 1).toLocaleDateString("en-PH", {
    timeZone: "Asia/Manila", month: "long", year: "numeric",
  });
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const weekdays = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
  let days = weekdays.map((d) => `<span class="calendar-weekday">${d}</span>`).join("");
  for (let i = 0; i < firstWeekday; i++) days += '<span class="calendar-empty"></span>';
  for (let day = 1; day <= daysInMonth; day++) {
    const iso = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const future = iso > today;
    const active = iso === selected;
    days += `<button type="button" class="calendar-day ${active ? "selected" : ""}" data-calendar-date="${iso}" data-calendar-kind="${kind}" ${future ? "disabled" : ""}>${day}</button>`;
  }
  calendar.innerHTML = `<header class="calendar-header"><button type="button" data-calendar-month="-1" aria-label="Previous month">‹</button><b>${esc(monthName)}</b><button type="button" data-calendar-month="1" aria-label="Next month">›</button></header><div class="calendar-grid">${days}</div>`;
  calendar.hidden = false;
}

function closeAllCalendars() {
  $("sales-calendar").hidden = true;
  $("report-calendar").hidden = true;
}

function setSalesDate(iso, source = "calendar") {
  if (iso > manilaDate()) iso = manilaDate();
  if (!["today", "yesterday", "week"].includes(source))
    activeSalesFilter = { type: "date", from: iso, to: iso };
  $("sales-date").value = iso;
  $("sales-date-label").textContent = formatDateLabel(iso);
  $("report-date").value = iso;
  $("report-date-label").textContent = formatDateLabel(iso);
  document.querySelectorAll("[data-date-preset]").forEach((b) => b.classList.remove("on"));
  if (source === "today") document.querySelector('[data-date-preset="today"]')?.classList.add("on");
  if (source === "yesterday") document.querySelector('[data-date-preset="yesterday"]')?.classList.add("on");
  if (source === "week") document.querySelector('[data-date-preset="week"]')?.classList.add("on");
  closeAllCalendars();
  loadSales();
  if ($("salesDlg").open) loadReport(iso);
}

/* ---------- calendar navigation and presets ---------- */
document.querySelectorAll("[data-date-preset]").forEach((button) => {
  button.onclick = () => {
    document.querySelectorAll("[data-date-preset]").forEach((b) => b.classList.toggle("on", b === button));
    const preset = button.dataset.datePreset;
    if (preset === "today") {
      activeSalesFilter = { type: "today", from: manilaDate(), to: manilaDate() };
      setSalesDate(manilaDate(), "today");
    }
    if (preset === "yesterday") {
      const date = yesterdayDate();
      activeSalesFilter = { type: "yesterday", from: date, to: date };
      setSalesDate(date, "yesterday");
    }
    if (preset === "week") {
      activeSalesFilter = { type: "week", from: shiftManilaDate(manilaDate(), -6), to: manilaDate() };
      setSalesDate(manilaDate(), "week");
      if ($("salesDlg").open) loadRangeReport(shiftManilaDate(manilaDate(), -6), manilaDate());
    }
  };
});

document.querySelectorAll("[data-date-step]").forEach((button) => {
  button.onclick = () => setSalesDate(shiftManilaDate($("sales-date").value || manilaDate(), Number(button.dataset.dateStep)));
});

document.querySelectorAll("[data-report-step]").forEach((button) => {
  button.onclick = () => setSalesDate(shiftManilaDate($("report-date").value || manilaDate(), Number(button.dataset.reportStep)), "calendar");
});

document.querySelectorAll("[data-calendar-toggle]").forEach((button) => {
  button.onclick = (event) => {
    event.stopPropagation();
    const kind = button.dataset.calendarToggle;
    const calendar = $(kind === "sales" ? "sales-calendar" : "report-calendar");
    const wasHidden = calendar.hidden;
    closeAllCalendars();
    if (wasHidden) renderBrandedCalendar(kind);
  };
});

document.addEventListener("click", (event) => {
  if (!event.target.closest(".branded-date")) closeAllCalendars();
  const monthButton = event.target.closest("[data-calendar-month]");
  if (monthButton) {
    event.stopPropagation();
    const selectedKind = monthButton.closest(".branded-calendar").id.startsWith("sales") ? "sales" : "report";
    calendarMonth.setMonth(calendarMonth.getMonth() + Number(monthButton.dataset.calendarMonth));
    renderBrandedCalendar(selectedKind);
  }
  const day = event.target.closest("[data-calendar-date]");
  if (day) setSalesDate(day.dataset.calendarDate, "calendar");
});
