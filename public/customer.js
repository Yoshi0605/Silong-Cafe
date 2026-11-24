// Silong Café customer page. Talks to the Node/MySQL backend: GET /api/menu, POST /api/orders, GET /api/orders/:id
/* ---------- state & helpers ---------- */
const $ = (s) => document.querySelector(s);
const peso = (n) => "₱" + n;
const ICON = {
  espresso: "☕",
  classic: "☕",
  signature: "✨",
  noncoffee: "🍓",
  matcha: "🍵",
  frappe: "🥤",
  yogurt: "🍑",
  kislap: "🫧",
};
let M,
  demo = false,
  mode = "",
  q = "",
  type = "Dine-in";
let cart = JSON.parse(localStorage.getItem("silongCart") || "[]");
let paymentMethod = "Cash";
let receiptFile = null;
let favs = new Set(JSON.parse(localStorage.getItem("silongFavs") || "[]"));
let paymentProvider = "";

const PAYMENT_PROVIDER_RULES = {
  GCash: { regex: /^\d{13}$/, min: 13, max: 13, numeric: true, help: "GCash requires exactly 13 numeric digits" },
  Maya: { regex: /^[A-Za-z0-9]{12,16}$/, min: 12, max: 16, help: "Maya requires 12 to 16 alphanumeric characters" },
  SeaBank: { regex: /^[A-Za-z0-9]{10,20}$/, min: 10, max: 20, help: "SeaBank requires 10 to 20 alphanumeric characters" },
  GrabPay: { regex: /^[A-Za-z0-9]{10,20}$/, min: 10, max: 20, help: "GrabPay requires 10 to 20 alphanumeric characters" },
  BDO: { regex: /^[A-Za-z0-9]{10,18}$/, min: 10, max: 18, help: "BDO requires 10 to 18 alphanumeric characters" },
  BPI: { regex: /^[A-Za-z0-9]{10,18}$/, min: 10, max: 18, help: "BPI requires 10 to 18 alphanumeric characters" },
  UnionBank: { regex: /^[A-Za-z0-9]{10,18}$/, min: 10, max: 18, help: "UnionBank requires 10 to 18 alphanumeric characters" },
  Metrobank: { regex: /^[A-Za-z0-9]{10,18}$/, min: 10, max: 18, help: "Metrobank requires 10 to 18 alphanumeric characters" },
  GoTyme: { regex: /^[A-Za-z0-9]{10,18}$/, min: 10, max: 18, help: "GoTyme requires 10 to 18 alphanumeric characters" },
};
const all = () =>
  M.categories.flatMap((c) => c.items.map((i) => ({ ...i, cat: c.id })));
const find = (n) => all().find((i) => i.n === n);
const unit = (l) =>
  find(l.name).p.find((o) => o[0] === l.variant)[1] +
  l.addons.reduce((s, a) => s + M.addons.find((x) => x.name === a).price, 0);
const sum = () => cart.reduce((s, l) => s + unit(l) * l.qty, 0),
  count = () => cart.reduce((s, l) => s + l.qty, 0);
const save = () => {
  localStorage.setItem("silongCart", JSON.stringify(cart));
  drawBar();
};
function toast(msg) {
  const t = document.createElement("div");
  t.className = "toast";
  t.textContent = msg;
  $("#toasts").appendChild(t);
  setTimeout(() => t.remove(), 2200);
}

function hours() {
  // Manila time
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Manila",
      weekday: "short",
      hour: "numeric",
      minute: "numeric",
      hour12: false,
    })
      .formatToParts(new Date())
      .map((x) => [x.type, x.value]),
  );
  const t = (+p.hour % 24) * 60 + +p.minute,
    wk = ["Mon", "Tue", "Wed", "Thu"].includes(p.weekday);
  const open = wk ? t >= 420 && t < 1380 : t >= 600;
  $("#open").innerHTML =
    `<span class="dot"></span>${open ? "Open now" : "Closed right now. You can still order ahead."}`;
  $("#hours").classList.toggle("open", open);
}
function addLine(name, variant, addons, qty) {
  const k = (l) => l.name + l.variant + l.addons.join(),
    nl = { name, variant, addons, qty },
    ex = cart.find((l) => k(l) === k(nl));
  ex ? (ex.qty += qty) : cart.push(nl);
  save();
  $("#bar").classList.add("bump");
  setTimeout(() => $("#bar").classList.remove("bump"), 300);
  toast(`Added ${qty} × ${name}`);
}
function drawBar() {
  $("#bar").classList.toggle("show", count() > 0);
  $("#bc").textContent =
    `View order · ${count()} item${count() > 1 ? "s" : ""}`;
  $("#bt").textContent = peso(sum());
}

/* ---------- menu ---------- */
const visible = (i) =>
  (!q || (i.n + " " + (i.d || "")).toLowerCase().includes(q)) &&
  (mode === "" ||
    (mode === "best"
      ? i.t === "best"
      : mode === "fav"
        ? favs.has(i.n)
        : i.p.some((o) => o[0] === mode)));
function renderMenu() {
  const cats = M.categories
    .map((c) => ({ ...c, list: c.items.filter(visible) }))
    .filter((c) => c.list.length);
  $("#tabs").innerHTML = cats
    .map((c) => `<a href="#${c.id}">${ICON[c.id] || ""} ${c.name}</a>`)
    .join("");
  $("#menu").innerHTML =
    cats
      .map(
        (c) =>
          `<section class="cat" id="${c.id}"><h2>${c.name}</h2>${c.note ? `<p class="note">${c.note}</p>` : ""}<div class="grid">${c.list
            .map((i) => {
              const lo = Math.min(...i.p.map((o) => o[1])),
                multi = i.p.length > 1 && i.p[0][1] !== i.p[1][1];
              return `<article class="item" data-n="${i.n}" tabindex="0" role="button" aria-label="Customize ${i.n}">
      <div class="ico" aria-hidden="true">${ICON[c.id]}</div><b>${i.n}</b>
      <span>${i.t ? `<span class="badge ${i.t}">${M.tags[i.t]}</span>` : ""}${i.d ? `<br><small>${i.d}</small>` : ""}</span>
      <span class="pr"><span>${i.p.map((o) => o[0]).join(" / ")}</span><span>${multi ? "from " : ""}${peso(lo)}</span></span>
      <button class="fav ${favs.has(i.n) ? "on" : ""}" data-fav aria-label="Favorite ${i.n}" aria-pressed="${favs.has(i.n)}">${favs.has(i.n) ? "♥" : "♡"}</button>
      <button class="add" data-quick aria-label="Quick add ${i.n}">+</button></article>`;
            })
            .join("")}</div></section>`,
      )
      .join("") ||
    `<div class="none">Nothing matches. Try another search or filter.</div>`;
  observe();
}
function observe() {
  if (renderMenu.io) renderMenu.io.disconnect();
  renderMenu.io = new IntersectionObserver(updateActiveCategory, {
    rootMargin: "-30% 0px -65% 0px",
  });
  document
    .querySelectorAll("section.cat")
    .forEach((s) => renderMenu.io.observe(s));

  if (!observe.scrollReady) {
    observe.scrollReady = true;
    window.addEventListener(
      "scroll",
      () => {
        cancelAnimationFrame(observe.frame);
        observe.frame = requestAnimationFrame(updateActiveCategory);
      },
      { passive: true },
    );
    window.addEventListener("resize", updateActiveCategory);
  }
  updateActiveCategory();
}
$("#menu").onclick = (e) => {
  const card = e.target.closest(".item");
  if (!card) return;
  const it = find(card.dataset.n);
  if (e.target.closest("[data-fav]")) {
    favs.has(it.n) ? favs.delete(it.n) : favs.add(it.n);
    localStorage.setItem("silongFavs", JSON.stringify([...favs]));
    return renderMenu();
  }
  if (e.target.closest("[data-quick]"))
    return addLine(
      it.n,
      (it.p.find(
        (o) => o[0] === (mode === "Hot" || mode === "Iced" ? mode : ""),
      ) || it.p[0])[0],
      [],
      1,
    );
  openItem(it);
};
$("#menu").onkeydown = (e) => {
  if (e.key === "Enter" && e.target.classList.contains("item"))
    openItem(find(e.target.dataset.n));
};
$("#search").oninput = (e) => {
  q = e.target.value.trim().toLowerCase();
  renderMenu();
};
$("#filters").onclick = (e) => {
  const b = e.target.closest(".chip");
  if (!b) return;
  mode = b.dataset.f;
  document
    .querySelectorAll("#filters .chip")
    .forEach((c) => c.classList.toggle("on", c === b));
  renderMenu();
};

/* quick order dropdowns */
function fillQ() {
  $("#qi").innerHTML = M.categories[$("#qc").value].items
    .map((i) => `<option>${i.n}</option>`)
    .join("");
  fillV();
}
function fillV() {
  $("#qv").innerHTML = find($("#qi").value)
    .p.map((o) => `<option value="${o[0]}">${o[0]} · ${peso(o[1])}</option>`)
    .join("");
}
$("#qc").onchange = fillQ;
$("#qi").onchange = fillV;
$("#qa").onclick = () =>
  addLine($("#qi").value, $("#qv").value, [], +$("#qq").value);

/* ---------- item sheet ---------- */
function openItem(it) {
  const d = $("#itemDlg");
  let opt = Math.max(
      0,
      it.p.findIndex((o) => o[0] === mode),
    ),
    qty = 1;
  const ad = new Set();
  const draw = () => {
    const u = it.p[opt][1] + [...ad].reduce((s, i) => s + M.addons[i].price, 0);
    d.innerHTML = `<form method="dialog" class="sheet"><h3>${it.n}</h3>${it.d ? `<p class="muted">${it.d}</p>` : ""}
      <p class="lbl">Choose one</p><div class="chips">${it.p.map((o, i) => `<button type="button" class="chip ${i === opt ? "on" : ""}" data-o="${i}">${o[0]} · ${peso(o[1])}</button>`).join("")}</div>
      <p class="lbl">Add-ons</p><div class="chips">${M.addons.map((a, i) => `<button type="button" class="chip ${ad.has(i) ? "on" : ""}" data-a="${i}">${a.name} +${peso(a.price)}</button>`).join("")}</div>
      <div class="row"><div class="step"><button type="button" data-q="-1" aria-label="Less">−</button><span>${qty}</span><button type="button" data-q="1" aria-label="More">+</button></div>
      <button type="button" class="btn" data-add>Add to order · ${peso(u * qty)}</button></div><button class="x" value="cancel" aria-label="Close">×</button></form>`;
  };
  d.onclick = (e) => {
    const t = e.target.closest("button");
    if (!t) return;
    if (t.dataset.o) opt = +t.dataset.o;
    else if (t.dataset.a) {
      const i = +t.dataset.a;
      ad.has(i) ? ad.delete(i) : ad.add(i);
    } else if (t.dataset.q) qty = Math.min(20, Math.max(1, qty + +t.dataset.q));
    else if ("add" in t.dataset) {
      addLine(
        it.n,
        it.p[opt][0],
        [...ad].map((i) => M.addons[i].name),
        qty,
      );
      return d.close();
    } else return;
    draw();
  };
  draw();
  d.showModal();
}

/* ---------- cart & checkout ---------- */
function drawCart() {
  $("#lines").innerHTML = cart.length
    ? cart
        .map(
          (
            l,
            i,
          ) => `<div class="line"><div><b>${l.name}</b><small>${l.variant}${l.addons.length ? " + " + l.addons.join(", ") : ""}</small></div>
    <div class="step"><button type="button" data-i="${i}" data-d="-1" aria-label="Less">−</button><span>${l.qty}</span><button type="button" data-i="${i}" data-d="1" aria-label="More">+</button></div><b>${peso(unit(l) * l.qty)}</b></div>`,
        )
        .join("")
    : '<p class="muted">Nothing here yet. Pick a drink from the menu.</p>';
  $("#ct").textContent = peso(sum());
  $("#place").disabled = !cart.length;
}
$("#lines").onclick = (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  const l = cart[b.dataset.i];
  l.qty += +b.dataset.d;
  if (l.qty < 1) cart.splice(b.dataset.i, 1);
  save();
  drawCart();
  if (!cart.length) $("#cartDlg").close();
};
$("#bar").onclick = () => {
  drawCart();
  $("#cartDlg").showModal();
};
$("#f-types").onclick = (e) => {
  const b = e.target.closest(".chip");
  if (!b) return;
  type = b.dataset.v;
  document
    .querySelectorAll("#f-types .chip")
    .forEach((c) => c.classList.toggle("on", c === b));
  $("#tblWrap").style.display = type === "Dine-in" ? "" : "none";
};
$("#f-name").value = localStorage.getItem("silongName") || "";

$("#place").onclick = async () => {
  const name = $("#f-name").value.trim();
  const referenceNumber = $("#f-reference").value.replace(/\s/g, "").trim();
  $("#err").textContent = "";
  if (!name) {
    $("#err").textContent = "Please enter your name.";
    return $("#f-name").focus();
  }
  if (paymentMethod !== "Cash") {
    if (!paymentProvider) {
      $("#err").textContent = "Please select a payment provider.";
      return $("#payment-providers").querySelector(".chip")?.focus();
    }
    const rule = PAYMENT_PROVIDER_RULES[paymentProvider];
    if (!referenceNumber) {
      $("#err").textContent = "Please enter the payment reference number.";
      return $("#f-reference").focus();
    }
    if (!rule.regex.test(referenceNumber)) {
      $("#err").textContent = rule.help;
      return $("#f-reference").focus();
    }
    if (!receiptFile) {
      $("#err").textContent = "Please attach a photo of the payment receipt.";
      return $("#f-receipt").focus();
    }
  }
  $("#place").disabled = true;
  const body = {
    customer: name,
    phone: $("#f-phone").value,
    type,
    table: type === "Dine-in" ? $("#f-table").value : "",
    notes: $("#f-notes").value,
    items: cart,
    paymentMethod,
    paymentProvider,
    referenceNumber,
    receiptUrl: "",
  };
  try {
    if (paymentMethod !== "Cash")
      body.receiptUrl = await uploadReceipt(receiptFile);
    let o;
    if (demo) {
      const n = (+localStorage.getItem("silongDemoNo") || 0) + 1;
      localStorage.setItem("silongDemoNo", n);
      o = {
        id: "demo" + n,
        order_no: String(n).padStart(3, "0"),
        total: sum(),
        at: Date.now(),
      };
    } else {
      const r = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Something went wrong.");
      o = j;
    }
    localStorage.setItem("silongName", name);
    localStorage.setItem(
      "silongOrder",
      JSON.stringify({
        id: o.id,
        no: o.order_no,
        total: o.total,
        name,
        at: o.at || Date.now(),
      }),
    );
    cart = [];
    save();
    $("#f-notes").value = "";
    $("#f-reference").value = "";
    $("#f-receipt").value = "";
    $("#receipt-preview").hidden = true;
    $("#upload-status").textContent = "";
    receiptFile = null;
    $("#cartDlg").close();
    poll(true);
  } catch (e) {
    $("#err").textContent = e.message + " Please try again.";
  }
  $("#place").disabled = false;
};

/* ---------- order tracking ---------- */
const LBL = {
  new: "Order received",
  preparing: "Being brewed",
  ready: "Ready! Please pick it up",
  done: "Served",
  cancelled: "Cancelled",
};
async function status(o) {
  if (String(o.id).startsWith("demo")) {
    // simulated progress
    const s = (Date.now() - o.at) / 1000;
    return {
      status: s < 10 ? "new" : s < 30 ? "preparing" : s < 90 ? "ready" : "done",
      order_no: o.no,
      total: o.total,
      customer: o.name,
    };
  }
  const r = await fetch("/api/orders/" + o.id);
  if (!r.ok) throw 0;
  return r.json();
}
async function poll(show) {
  const o = JSON.parse(localStorage.getItem("silongOrder") || "null");
  if (!o) return;
  try {
    const j = await status(o),
      idx = ["new", "preparing", "ready"].indexOf(j.status);
    $("#dn").textContent = "#" + j.order_no;
    $("#dm").textContent =
      j.status === "cancelled"
        ? "This order was cancelled. Please ask the staff."
        : `${LBL[j.status]} · Total ${peso(j.total)}. We’ll call “${j.customer}”.`;
    $("#ds").innerHTML = [
      ["📝", "Received"],
      ["☕", "Brewing"],
      ["🛎", "Ready"],
    ]
      .map(
        ([e, s], i) =>
          `<div class="${i <= idx ? "on" : ""} ${i === idx ? "now" : ""}"><span>${e}</span>${s}</div>`,
      )
      .join("");
    const t = $("#track");
    t.hidden = false;
    t.textContent = `Order #${j.order_no} · ${LBL[j.status]}`;
    if (show) $("#doneDlg").showModal();
    if (poll.last && poll.last !== j.status && j.status === "ready") {
      toast("Your order is ready!");
    }
    poll.last = j.status;
    if (["done", "cancelled"].includes(j.status)) {
      localStorage.removeItem("silongOrder");
      setTimeout(() => (t.hidden = true), 8000);
      return;
    }
  } catch (e) {}
  clearTimeout(poll.t);
  poll.t = setTimeout(poll, 4000);
}
$("#track").onclick = () => $("#doneDlg").showModal();

/* ---------- admin sign in ---------- */
$("#adminSignin").onclick = () => {
  $("#adminErr").textContent = "";
  $("#adminPass").value = "";
  $("#adminDlg").showModal();
  $("#adminPass").focus();
};
$("#closeAdmin").onclick = () => $("#adminDlg").close();
$("#adminForm").onsubmit = async (e) => {
  e.preventDefault();
  $("#adminErr").textContent = "";
  $("#adminSubmit").disabled = true;
  try {
    const r = await fetch("/api/admin/login", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: $("#adminPass").value.trim() }),
    });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error || "Sign-in failed.");
    window.location.href = "/kitchen";
  } catch (e) {
    $("#adminErr").textContent = e.message;
  }
  $("#adminSubmit").disabled = false;
};

/* ---------- start ---------- */
(async function init() {
  try {
    const r = await fetch("/api/menu");
    if (!r.ok) throw 0;
    M = await r.json();
  } catch (e) {
    $("#menu").innerHTML =
      '<div class="none">Can’t reach the café server right now. Please refresh in a moment.</div>';
    return;
  }
  $("#qc").innerHTML = M.categories
    .map((c, i) => `<option value="${i}">${c.name}</option>`)
    .join("");
  $("#qq").innerHTML = [1, 2, 3, 4, 5, 6]
    .map((n) => `<option>${n}</option>`)
    .join("");
  fillQ();
  renderMenu();
  drawBar();
  hours();
  setInterval(hours, 60000);
  poll();
})();

function setActiveTab(id) {
  let activeLink = null;
  document.querySelectorAll(".tabs a").forEach((a) => {
    const active = a.hash === "#" + id;
    a.classList.toggle("on", active);
    if (active) activeLink = a;
  });
  if (activeLink) {
    const tabs = $("#tabs");
    const left = activeLink.offsetLeft;
    const right = left + activeLink.offsetWidth;
    if (left < tabs.scrollLeft) tabs.scrollLeft = left;
    else if (right > tabs.scrollLeft + tabs.clientWidth)
      tabs.scrollLeft = right - tabs.clientWidth;
  }
}

function updateActiveCategory() {
  const sections = [...document.querySelectorAll("section.cat")];
  if (!sections.length) return;
  const marker = window.innerHeight * 0.35;
  let active = sections[0];
  for (const section of sections) {
    if (section.getBoundingClientRect().top <= marker) active = section;
  }
  const atBottom =
    window.scrollY + window.innerHeight >=
    document.documentElement.scrollHeight - 4;
  if (atBottom) active = sections[sections.length - 1];
  setActiveTab(active.id);
}
window.addEventListener("scroll", updateActiveCategory);

function updateReferenceRules() {
  const rule = PAYMENT_PROVIDER_RULES[paymentProvider];
  if (!rule) {
    $("#reference-help").textContent = "Select a provider to see the required reference format";
    $("#reference-count").textContent = "0 characters";
    return;
  }
  $("#f-reference").value = $("#f-reference").value.replace(/\s/g, "");
  $("#f-reference").setAttribute("maxlength", rule.max);
  $("#f-reference").setAttribute("inputmode", rule.numeric ? "numeric" : "text");
  $("#reference-count").textContent = `${$("#f-reference").value.length} / ${rule.max} characters`;
}

function renderPaymentProviders() {
  const providers = paymentMethod === "E-Wallet"
    ? ["GCash", "Maya", "SeaBank", "GrabPay"]
    : ["BDO", "BPI", "UnionBank", "Metrobank", "GoTyme"];
  $("#payment-providers").innerHTML = providers
    .map((provider) => `<button type="button" class="chip ${provider === paymentProvider ? "on" : ""}" data-provider="${provider}">${provider}</button>`)
    .join("");
  updateReferenceRules();
}

$("#payment-types").onclick = (e) => {
  const b = e.target.closest(".chip");
  if (!b) return;
  paymentMethod = b.dataset.payment;
  document
    .querySelectorAll("#payment-types .chip")
    .forEach((c) => c.classList.toggle("on", c === b));
  $("#provider-payment").hidden = paymentMethod === "Cash";
  if (paymentMethod === "Cash") {
    paymentProvider = "";
    $("#f-reference").value = "";
    $("#f-receipt").value = "";
    receiptFile = null;
  }
  renderPaymentProviders();
};

$("#payment-providers").onclick = (e) => {
  const b = e.target.closest(".chip");
  if (!b) return;
  paymentProvider = b.dataset.provider;
  document
    .querySelectorAll("#payment-providers .chip")
    .forEach((c) => c.classList.toggle("on", c === b));
  updateReferenceRules();
};

$("#f-reference").oninput = (e) => {
  e.target.value = e.target.value.replace(/\s/g, "");
  updateReferenceRules();
};

$("#f-receipt").onchange = (e) => {
  receiptFile = e.target.files?.[0] || null;
  const preview = $("#receipt-preview");
  if (!receiptFile) {
    preview.hidden = true;
    preview.removeAttribute("src");
    return;
  }
  preview.src = URL.createObjectURL(receiptFile);
  preview.hidden = false;
};

async function compressReceipt(file) {
  const bitmap = await createImageBitmap(file);
  const maxSize = 1600;
  const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve) =>
    canvas.toBlob((blob) => resolve(blob || file), "image/jpeg", 0.82),
  );
}

async function uploadReceipt(file) {
  const configRes = await fetch("/api/cloudinary/config");
  const config = await configRes.json();
  if (!config.cloudName || !config.uploadPreset)
    throw new Error("Cloudinary upload is not configured.");
  const compressed = await compressReceipt(file);
  const form = new FormData();
  form.append("file", compressed, "silong-receipt.jpg");
  form.append("upload_preset", config.uploadPreset);
  $("#upload-status").textContent = "Uploading receipt…";
  const uploadRes = await fetch(
    `https://api.cloudinary.com/v1_1/${encodeURIComponent(config.cloudName)}/image/upload`,
    { method: "POST", body: form },
  );
  const upload = await uploadRes.json();
  if (!uploadRes.ok || !upload.secure_url)
    throw new Error(upload.error?.message || "Receipt upload failed.");
  $("#upload-status").textContent = "Receipt uploaded.";
  return upload.secure_url;
}
