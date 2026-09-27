/* Annonces BODACC publiques (Île-de-France). Pas de clé, pas de score inventé. */
(function () {
  const API = "https://bodacc-datadila.opendatasoft.com/api/explore/v2.1/catalog/datasets/annonces-commerciales/records";
  const DEPTS = ["75", "77", "78", "91", "92", "93", "94", "95"];

  function safeUrl(u) {
    try {
      const x = new URL(String(u || ""));
      return x.protocol === "https:" ? x.href : "";
    } catch (e) {
      return "";
    }
  }

  function natureOf(j) {
    try {
      const o = typeof j === "string" ? JSON.parse(j) : (j || {});
      return String(o.nature || "");
    } catch (e) {
      return "";
    }
  }

  function labelOf(famille, nature) {
    if (famille === "vente") return "Cession";
    const n = nature.toLowerCase();
    if (/cl[oô]ture/.test(n)) return "";
    if (n.includes("liquidation")) return "Liquidation";
    if (n.includes("redressement")) return "Redressement";
    if (n.includes("sauvegarde")) return "Sauvegarde";
    return "Procédure";
  }

  window.filonAnnonces = async function () {
    const since = new Date(Date.now() - 21 * 864e5).toISOString().slice(0, 10);
    const deps = DEPTS.map(function (d) { return 'numerodepartement="' + d + '"'; }).join(" OR ");
    const where = '(familleavis="collective" OR familleavis="vente") AND (' + deps + ") AND dateparution>=date'" + since + "'";
    const url = API + "?limit=80&order_by=dateparution%20desc&select=id,commercant,ville,numerodepartement,dateparution,familleavis,jugement,url_complete&where=" + encodeURIComponent(where);
    const res = await fetch(url);
    if (!res.ok) throw new Error(String(res.status));
    const data = await res.json();
    const seen = new Set();
    const out = [];
    (data.results || []).forEach(function (r) {
      const nom = String(r.commercant || "").replace(/\s+/g, " ").trim();
      if (!nom || nom.includes(",") || /\b(M\.|Mme|Monsieur|Madame)\b/.test(nom)) return;
      const label = labelOf(r.familleavis, natureOf(r.jugement));
      if (!label) return;
      const key = String(r.id || nom + r.dateparution);
      if (seen.has(key)) return;
      seen.add(key);
      out.push({
        nom: nom.slice(0, 120),
        commune: String(r.ville || "").slice(0, 80),
        dept: String(r.numerodepartement || ""),
        date: String(r.dateparution || ""),
        label: label,
        kind: label === "Cession" ? "cession" : "procedure",
        url: safeUrl(r.url_complete)
      });
    });
    return out;
  };
})();
