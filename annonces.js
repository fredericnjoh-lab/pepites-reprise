/* Annonces BODACC publiques (Île-de-France). Pas de clé, pas de score inventé. */
(function () {
  const API = "https://bodacc-datadila.opendatasoft.com/api/explore/v2.1/catalog/datasets/annonces-commerciales/records";
  const SIRENE = "https://recherche-entreprises.api.gouv.fr/search";
  const DEPTS = ["75", "77", "78", "91", "92", "93", "94", "95"];
  const EFF = {
    "00": "0 salarié",
    "01": "1-2",
    "02": "3-5",
    "03": "6-9",
    "11": "10-19",
    "12": "20-49",
    "21": "50-99",
    "22": "100-199",
    "31": "200-249",
    "32": "250-499",
    "41": "500-999",
    "42": "1 000-1 999",
    "51": "2 000-4 999",
    "52": "5 000-9 999",
    "53": "10 000 et plus",
    "NN": "Non communiqué"
  };
  const sireneCache = new Map();

  function safeUrl(u) {
    try {
      const x = new URL(String(u || ""));
      return x.protocol === "https:" ? x.href : "";
    } catch (e) {
      return "";
    }
  }

  function jugementOf(j) {
    try {
      const o = typeof j === "string" ? JSON.parse(j) : (j || {});
      return {
        nature: String(o.nature || "").replace(/\s+/g, " ").trim(),
        date: String(o.date || "").replace(/\s+/g, " ").trim(),
        complement: String(o.complementJugement || "").replace(/\s+/g, " ").trim().slice(0, 400)
      };
    } catch (e) {
      return { nature: "", date: "", complement: "" };
    }
  }

  function sirenOf(reg) {
    const arr = Array.isArray(reg) ? reg : (reg ? [reg] : []);
    for (let i = 0; i < arr.length; i++) {
      const digits = String(arr[i] || "").replace(/\D/g, "");
      if (digits.length >= 9) return digits.slice(0, 9);
    }
    return "";
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

  function fmtFr(d) {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d || "");
    if (m) return m[3] + "/" + m[2] + "/" + m[1];
    return String(d || "").replace(/\s+/g, " ").trim().slice(0, 48);
  }

  function fmtMoney(n) {
    if (typeof n !== "number" || !isFinite(n)) return "";
    const sign = n < 0 ? "−" : "";
    const abs = Math.abs(n);
    if (abs >= 1e6) return sign + (abs / 1e6).toLocaleString("fr-FR", { maximumFractionDigits: 1 }) + " M€";
    if (abs >= 1e3) return sign + Math.round(abs / 1e3).toLocaleString("fr-FR") + " k€";
    return sign + Math.round(abs).toLocaleString("fr-FR") + " €";
  }

  function yearOf(v) {
    const y = String(v || "");
    return /^\d{4}$/.test(y) ? y : "";
  }

  window.filonAnnonces = async function () {
    const since = new Date(Date.now() - 21 * 864e5).toISOString().slice(0, 10);
    const deps = DEPTS.map(function (d) { return 'numerodepartement="' + d + '"'; }).join(" OR ");
    const where = '(familleavis="collective" OR familleavis="vente") AND (' + deps + ") AND dateparution>=date'" + since + "'";
    const select = "id,commercant,ville,numerodepartement,dateparution,familleavis,jugement,url_complete,registre,tribunal";
    const url = API + "?limit=80&order_by=dateparution%20desc&select=" + select + "&where=" + encodeURIComponent(where);
    const res = await fetch(url);
    if (!res.ok) throw new Error(String(res.status));
    const data = await res.json();
    const seen = new Set();
    const out = [];
    (data.results || []).forEach(function (r) {
      const nom = String(r.commercant || "").replace(/\s+/g, " ").trim();
      if (!nom || nom.includes(",") || /\b(M\.|Mme|Monsieur|Madame)\b/.test(nom)) return;
      const j = jugementOf(r.jugement);
      const label = labelOf(r.familleavis, j.nature);
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
        url: safeUrl(r.url_complete),
        siren: sirenOf(r.registre),
        tribunal: String(r.tribunal || "").replace(/\s+/g, " ").trim().slice(0, 160),
        nature: j.nature.slice(0, 180),
        jugementDate: j.date.slice(0, 48),
        complement: j.complement
      });
    });
    return out;
  };

  window.filonSirene = async function (siren) {
    if (!/^\d{9}$/.test(siren || "")) return { ok: false, reason: "miss" };
    if (sireneCache.has(siren)) return sireneCache.get(siren);
    const job = (async function () {
      let res;
      try {
        res = await fetch(SIRENE + "?q=" + encodeURIComponent(siren) + "&per_page=1");
      } catch (e) {
        return { ok: false, reason: "http" };
      }
      if (!res.ok) return { ok: false, reason: "http" };
      let data;
      try { data = await res.json(); } catch (e) { return { ok: false, reason: "http" }; }
      const r = (data.results || []).find(function (x) { return x && x.siren === siren; });
      if (!r) return { ok: false, reason: "miss" };
      const fin = r.finances || {};
      const years = Object.keys(fin).filter(function (y) { return /^\d{4}$/.test(y); }).sort();
      const anneeFin = years.length ? years[years.length - 1] : "";
      const f = anneeFin ? (fin[anneeFin] || {}) : {};
      const siege = r.siege || {};
      const etat = r.etat_administratif === "A" ? "En activité" : r.etat_administratif === "C" ? "Cessée" : "";
      return {
        ok: true,
        siren: r.siren,
        nom: String(r.nom_complet || r.nom_raison_sociale || "").replace(/\s+/g, " ").trim().slice(0, 160),
        naf: String(r.activite_principale || ""),
        effectif: String(r.tranche_effectif_salarie || ""),
        anneeEffectif: yearOf(r.annee_tranche_effectif_salarie),
        creation: /^\d{4}-\d{2}-\d{2}/.test(r.date_creation || "") ? String(r.date_creation).slice(0, 10) : "",
        etat: etat,
        categorie: String(r.categorie_entreprise || ""),
        etablissements: typeof r.nombre_etablissements_ouverts === "number" ? r.nombre_etablissements_ouverts : null,
        adresse: String(siege.adresse || "").replace(/\s+/g, " ").trim().slice(0, 160),
        ca: typeof f.ca === "number" ? f.ca : null,
        resultat: typeof f.resultat_net === "number" ? f.resultat_net : null,
        anneeFin: anneeFin
      };
    })();
    sireneCache.set(siren, job);
    const result = await job;
    if (!result.ok && result.reason === "http") sireneCache.delete(siren);
    return result;
  };

  window.filonFicheLignes = function (x, s) {
    const lines = [];
    function add(k, v) {
      const t = String(v || "").trim();
      if (t) lines.push({ k: k, v: t });
    }
    if (x.siren) add("SIREN", x.siren.replace(/(\d{3})(\d{3})(\d{3})/, "$1 $2 $3"));
    if (s && s.ok) {
      add("Activité", s.naf);
      if (s.effectif && EFF[s.effectif]) add("Effectif", EFF[s.effectif] + (s.anneeEffectif ? " · " + s.anneeEffectif : ""));
      add("Création", fmtFr(s.creation));
      add("État", s.etat);
      add("Catégorie", s.categorie);
      if (typeof s.etablissements === "number") add("Établissements", String(s.etablissements));
      add("Siège", s.adresse);
      if (s.nom && s.nom.toUpperCase() !== String(x.nom || "").toUpperCase()) add("Dénomination", s.nom);
      if (typeof s.ca === "number") add("CA publié", fmtMoney(s.ca) + (s.anneeFin ? " · " + s.anneeFin : ""));
      if (typeof s.resultat === "number") add("Résultat net", fmtMoney(s.resultat) + (s.anneeFin ? " · " + s.anneeFin : ""));
    }
    add("Jugement", [x.nature || x.label, fmtFr(x.jugementDate)].filter(Boolean).join(" · "));
    add("Tribunal", x.tribunal);
    add("Parution", fmtFr(x.date));
    return lines;
  };

  window.filonFicheNote = function (x, s, state) {
    if (s && s.ok && (typeof s.ca === "number" || typeof s.resultat === "number")) return "Chiffres publiés au répertoire Sirene.";
    if (state === "loading" && x.siren) return "Lecture du répertoire Sirene.";
    if (state === "error") return "Le répertoire Sirene ne répond pas.";
    if (state === "miss" && x.siren) return "Aucune fiche Sirene pour ce SIREN.";
    return "";
  };
})();
