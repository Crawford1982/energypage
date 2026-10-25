// Spillway tracker. Formats numbers computed by the engine; computes none of its own
// beyond sums for display (e.g. adding two zones' bars).
(function () {
  "use strict";

  var ZONES = ["north_of_B4", "B4_to_B6"];
  var ZONE_LABEL = { north_of_B4: "North of B4", B4_to_B6: "B4 to B6" };
  var ZONE_CLASS = { north_of_B4: "north", B4_to_B6: "mid" };

  function $(id) { return document.getElementById(id); }
  function gwh(mwh) { return (mwh / 1000).toLocaleString("en-GB", { maximumFractionDigits: 1, minimumFractionDigits: 1 }); }
  function mwhText(mwh) { return mwh >= 1000 ? gwh(mwh) + " GWh" : Math.round(mwh).toLocaleString("en-GB") + " MWh"; }
  function money(gbp) {
    var a = Math.abs(gbp), s = gbp < 0 ? "−£" : "£";
    if (a >= 1e6) return s + (a / 1e6).toFixed(a >= 1e7 ? 1 : 2) + "m";
    if (a >= 1e3) return s + Math.round(a / 1e3).toLocaleString("en-GB") + "k";
    return s + Math.round(a).toLocaleString("en-GB");
  }
  function perMwh(v) { return v === null || v === undefined ? "—" : (v < 0 ? "−£" : "£") + Math.abs(v).toFixed(2); }
  function longDate(iso) {
    var d = new Date(iso + "T12:00:00Z");
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
  }
  function shortDate(iso) {
    var d = new Date(iso + "T12:00:00Z");
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
  }
  function el(tag, attrs, text) {
    var e = document.createElementNS("http://www.w3.org/2000/svg", tag);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (text !== undefined) e.textContent = text;
    return e;
  }

  function showStatus(msg) { var s = $("status"); s.textContent = msg; s.hidden = false; }

  function renderHero(d) {
    var w7 = d.windows["7d"], w30 = d.windows["30d"];
    $("kicker").textContent = "Scotland's wasted wind · 7 days to " + longDate(d.data_through);
    $("hero-gwh").textContent = gwh(w7.scotland.mwh);
    $("hero-gbp").textContent = money(w7.scotland.gbp);
    $("m30-gwh").textContent = gwh(w30.scotland.mwh) + " GWh";
    $("m30-gbp").textContent = money(w30.scotland.gbp);
  }

  function renderZones(d) {
    var z = d.windows["30d"].zones;
    document.querySelectorAll("[data-z]").forEach(function (node) {
      var v = z[node.getAttribute("data-z")][node.getAttribute("data-k")];
      var k = node.getAttribute("data-k");
      node.textContent = k === "mwh" ? mwhText(v) : k === "gbp" ? money(v) : perMwh(v);
    });
  }

  function renderChart(d) {
    var rows = d.daily, box = $("chart");
    // Draw at the container's real width so text stays readable on phones.
    var W = Math.max(320, Math.round(box.clientWidth || 960)), H = W < 600 ? 220 : 280;
    var L = 40, R = 6, T = 26, B = 26, labelEvery = W < 600 ? 30 : 15;
    var max = 0;
    rows.forEach(function (r) { max = Math.max(max, r.north_of_B4_mwh + r.B4_to_B6_mwh); });
    if (max === 0) { box.textContent = "No curtailment in this period."; return; }
    var stepG = [10, 20, 25, 50, 100, 200, 250, 500].find(function (s) { return max / 1000 / s <= 5; }) || 1000;
    var top = Math.ceil(max / 1000 / stepG) * stepG;
    var y = function (m) { return T + (H - T - B) * (1 - m / 1000 / top); };
    var bw = (W - L - R) / rows.length;
    var svg = el("svg", { viewBox: "0 0 " + W + " " + H });

    var axis = el("g", { "class": "axis" });
    for (var g = 0; g <= top; g += stepG) {
      axis.appendChild(el("line", { x1: L, x2: W - R, y1: y(g * 1000), y2: y(g * 1000), "class": "grid" }));
      axis.appendChild(el("text", { x: L - 6, y: y(g * 1000) + 4, "text-anchor": "end", "class": "tick" }, String(g)));
    }
    axis.appendChild(el("text", { x: 0, y: 12, "class": "tick" }, "GWh"));
    svg.appendChild(axis);

    rows.forEach(function (r, i) {
      var x = L + i * bw + bw * 0.12, w = bw * 0.76, base = 0;
      var tip = shortDate(r.date) + ": " + mwhText(r.north_of_B4_mwh + r.B4_to_B6_mwh) + " (" +
        "north of B4 " + mwhText(r.north_of_B4_mwh) + ", B4 to B6 " + mwhText(r.B4_to_B6_mwh) + "), paid " +
        money(r.north_of_B4_gbp + r.B4_to_B6_gbp);
      var g = el("g", {});
      g.appendChild(el("title", {}, tip));
      ZONES.forEach(function (z) {
        var v = r[z + "_mwh"];
        if (v <= 0) return;
        g.appendChild(el("rect", { x: x, width: w, y: y(base + v), height: y(base) - y(base + v), "class": "b-" + ZONE_CLASS[z] }));
        base += v;
      });
      svg.appendChild(g);
      if (i % labelEvery === 0) svg.appendChild(el("text", { x: x + w / 2, y: H - 6, "text-anchor": "middle", "class": "tick" }, shortDate(r.date)));
    });
    box.innerHTML = "";
    box.appendChild(svg);
    $("chart-note").textContent = "Hover a bar for that day's figures. Data through " + longDate(d.data_through) + ".";
  }

  function renderSites(d) {
    var tb = document.querySelector("#sites tbody");
    tb.innerHTML = "";
    d.top_sites_30d.forEach(function (s) {
      var tr = document.createElement("tr");
      var tag = '<span class="zone-tag" style="--zc: var(--' + ZONE_CLASS[s.zone] + ')"></span>';
      [s.site, null, mwhText(s.mwh), money(s.gbp), perMwh(s.gbp_per_mwh)].forEach(function (v, i) {
        var td = document.createElement("td");
        if (i === 1) { td.innerHTML = tag; td.firstChild.textContent = ZONE_LABEL[s.zone]; }
        else td.textContent = v;
        if (i >= 2) td.className = "num";
        tr.appendChild(td);
      });
      tb.appendChild(tr);
    });
  }

  function renderChecks(d) {
    var c = d.checks, ul = $("checks-list"), m = c.mapping;
    var label = {
      wind_curtailed_mwh_all: "GB wind switched off", wind_curtailed_mwh_north_of_B4: "north of B4 switched off",
      wind_payment_gbp_all: "GB payments", wind_payment_gbp_scotland: "Scottish payments",
      wind_payment_gbp_north_of_B4: "north of B4 payments"
    };
    var fmt = function (v, u) { return u === "TWh" ? v.toFixed(2) + " TWh" : "£" + Math.round(v) + "m"; };
    var parts = (c.annual_check || []).map(function (a) {
      return label[a.metric] + ": ours " + fmt(a.ours, a.unit) + ", Montel " + fmt(a.theirs, a.unit) +
        " (" + (a.delta_pct > 0 ? "+" : "") + a.delta_pct + "%)";
    });
    var year = (c.annual_check && c.annual_check[0]) ? c.annual_check[0].year : "";
    var items = [
      "Our " + year + " totals are checked against Montel's published figures. " + parts.join("; ") +
        ". Nothing is published if any differs by more than 10%.",
      "Boundary zones are assigned to " + m.scottish_units + " Scottish wind units; " + m.verified +
        " are verified against grid connection records so far. Treat zone splits as provisional.",
      "Every figure is computed from Elexon settlement data by deterministic code. No figure on this page is estimated or written by AI."
    ];
    ul.innerHTML = "";
    items.forEach(function (t) { var li = document.createElement("li"); li.textContent = t; ul.appendChild(li); });
  }

  function emptyState() {
    showStatus("First figures publish here once the data passes its checks. The engine is backfilling Elexon data from January 2025 now.");
    $("checks-list").innerHTML = "<li>Figures appear only after Spillway's annual totals agree with Montel's published figures within 10%.</li>";
    $("updated").textContent = "No published data yet.";
    $("chart").textContent = "";
  }

  fetch("data/latest.json?v=" + new Date().toISOString().slice(0, 13), { cache: "no-store" })
    .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(function (d) {
      renderHero(d); renderZones(d); renderChart(d); renderSites(d); renderChecks(d);
      $("updated").textContent = "Data through " + longDate(d.data_through) + ". Updated daily.";
    })
    .catch(emptyState);
})();
