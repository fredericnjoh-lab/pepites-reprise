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

  const SECTEURS = {
    it: "62.01Z,62.02A,62.02B,62.03Z,62.09Z,63.11Z,63.12Z,58.29A,58.29B,58.29C,61.10Z,61.20Z,61.90Z,95.11Z,46.51Z",
    services: "70.22Z,71.12B,73.11Z,73.20Z,74.10Z,78.10Z,81.21Z,80.10Z,82.11Z,85.59A",
    industrie: "33.12Z,33.13Z,33.14Z,33.20C,25.62B,25.11Z,28.29B,22.29A,18.12Z,26.51B",
    negoce: "46.69B,46.73A,46.90Z,46.44Z,46.18Z,46.52Z,46.66Z",
    transport: "49.41A,49.41B,52.29A,52.10B,53.20Z",
    btp: "43.21A,43.22A,43.22B,43.29A,43.32A,43.34Z,43.91B,43.99C,41.20B"
  };
  const BODACC_PAGES = 25;
  const CEDANT_PAGES = 8;
  const listeners = new Set();
  let catalogueJob = null;

  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  async function getJson(url) {
    for (let i = 0; i < 4; i++) {
      let res;
      try { res = await fetch(url); }
      catch (e) { await sleep(400 * (i + 1)); continue; }
      if (res.status === 429) {
        const wait = Number(res.headers.get("retry-after")) || (1 + i);
        await sleep(Math.min(wait, 8) * 1000);
        continue;
      }
      if (!res.ok) return null;
      try { return await res.json(); } catch (e) { return null; }
    }
    return null;
  }

  function asObj(v) {
    if (v == null) return null;
    if (typeof v === "object") return v;
    if (typeof v !== "string" || !v) return null;
    try { return JSON.parse(v); } catch (e) { return null; }
  }

  function asList(v, key) {
    const o = asObj(v);
    if (!o) return [];
    const inner = o[key] != null ? o[key] : o;
    return Array.isArray(inner) ? inner : [inner];
  }

  function personneSiren(p) {
    const id = p && p.numeroImmatriculation && p.numeroImmatriculation.numeroIdentification;
    return sirenOf(id);
  }

  function personneNom(p) {
    if (!p) return "";
    if (p.denomination) return String(p.denomination).replace(/\s+/g, " ").trim();
    if (p.typePersonne === "pp" || p.prenom || p.prenoms) return "";
    return String(p.nom || "").replace(/\s+/g, " ").trim();
  }

  function personLike(nom) {
    const s = String(nom || "").replace(/\s+/g, " ").trim();
    if (/\b(M\.|Mme|Monsieur|Madame|Mlle)\b/.test(s)) return true;
    if (/\((EI|EIRL)\)/i.test(s)) return true;
    const parts = s.split(",").map(function (p) { return p.trim(); }).filter(Boolean);
    if (parts.length >= 2 && parts.length <= 3) {
      const given = parts[1];
      if (given && given.split(/\s+/).length <= 3 && !/\d/.test(given) && !/\b(SARL|SASU|SAS|EURL|SCI|SA|SELARL|SNC)\b/i.test(s)) return true;
    }
    return false;
  }

  function parsePrix(text) {
    const m = String(text || "").match(/prix[^0-9]{0,40}([0-9][0-9\s\u00a0.,]*)/i);
    if (!m) return null;
    let s = m[1].trim().replace(/[\s\u00a0]/g, "").replace(/[.,]+$/, "");
    if (/,\d{1,2}$/.test(s)) s = s.replace(/\./g, "").replace(/,\d{1,2}$/, "");
    else if (/\.\d{1,2}$/.test(s)) s = s.replace(/,/g, "").replace(/\.\d{1,2}$/, "");
    else s = s.replace(/[.,]/g, "");
    if (!/^\d+$/.test(s)) return null;
    const n = Number(s);
    return n > 0 && n <= 1e9 ? n : null;
  }

  function numOrNull(v) {
    const n = typeof v === "number" ? v : (v == null || v === "" ? NaN : Number(v));
    return Number.isFinite(n) ? n : null;
  }

  function normalizeEntreprise(r) {
    if (!r || !/^\d{9}$/.test(r.siren || "")) return null;
    const siege = r.siege || {};
    const fin = r.finances || {};
    const financials = Object.keys(fin).filter(function (y) { return /^\d{4}$/.test(y); }).sort().reverse().map(function (y) {
      return { annee: Number(y), ca: numOrNull(fin[y] && fin[y].ca), resultat_net: numOrNull(fin[y] && fin[y].resultat_net) };
    });
    const latest = financials[0] || {};
    const officers = (r.dirigeants || []).filter(function (d) { return d && d.type_dirigeant === "personne physique" && d.nom; }).map(function (d) {
      return {
        nom: String(d.nom || ""),
        prenoms: String(d.prenoms || ""),
        qualite: String(d.qualite || ""),
        annee_naissance: d.annee_de_naissance ? Number(d.annee_de_naissance) : null,
        type_dirigeant: "personne physique"
      };
    });
    const etat = r.etat_administratif === "A" ? "En activité" : r.etat_administratif === "C" ? "Cessée" : "";
    return {
      ok: true,
      siren: r.siren,
      nom: String(r.nom_complet || r.nom_raison_sociale || "").replace(/\s+/g, " ").trim().slice(0, 160),
      naf: String(r.activite_principale || ""),
      section: String(r.section_activite_principale || ""),
      effectif: String(r.tranche_effectif_salarie || ""),
      anneeEffectif: yearOf(r.annee_tranche_effectif_salarie),
      creation: /^\d{4}-\d{2}-\d{2}/.test(r.date_creation || "") ? String(r.date_creation).slice(0, 10) : "",
      etat: etat,
      categorie: String(r.categorie_entreprise || ""),
      etablissements: typeof r.nombre_etablissements_ouverts === "number" ? r.nombre_etablissements_ouverts : null,
      adresse: String(siege.adresse || "").replace(/\s+/g, " ").trim().slice(0, 160),
      commune: String(siege.libelle_commune || ""),
      dept: String(siege.departement || ""),
      lat: numOrNull(siege.latitude),
      lon: numOrNull(siege.longitude),
      rge: !!(r.complements && r.complements.est_rge),
      ca: typeof latest.ca === "number" ? latest.ca : null,
      resultat: typeof latest.resultat_net === "number" ? latest.resultat_net : null,
      anneeFin: latest.annee ? String(latest.annee) : "",
      officers: officers,
      financials: financials
    };
  }

  window.filonSirene = async function (siren) {
    if (!/^\d{9}$/.test(siren || "")) return { ok: false, reason: "miss" };
    if (sireneCache.has(siren)) return sireneCache.get(siren);
    const job = (async function () {
      const data = await getJson(SIRENE + "?q=" + encodeURIComponent(siren) + "&per_page=1");
      if (!data) return { ok: false, reason: "http" };
      const r = (data.results || []).find(function (x) { return x && x.siren === siren; });
      return r ? normalizeEntreprise(r) : { ok: false, reason: "miss" };
    })();
    sireneCache.set(siren, job);
    const result = await job;
    if (!result.ok && result.reason === "http") sireneCache.delete(siren);
    return result;
  };

  function blank(siren) {
    return {
      siren: siren, nom: "", commune: "", dept: "", cp: "", date: "", label: "", kind: "", url: "",
      tribunal: "", nature: "", jugementDate: "", complement: "", source: "", naf: "", section: "", te: "",
      categorie: "", creation: "", etat: "", etablissements: null, adresse: "", lat: null, lon: null, rge: false,
      officers: [], financials: [], events: [], listings: [],
      vente_date: "", vente_prix: null, vente_role: "", vente_nature: "", enriched: false
    };
  }

  function company(map, siren) {
    if (!map.has(siren)) map.set(siren, blank(siren));
    return map.get(siren);
  }

  function putNom(c, nom) {
    const n = String(nom || "").replace(/\s+/g, " ").trim().slice(0, 160);
    if (!n || personLike(n)) return;
    if (!c.nom || personLike(c.nom)) c.nom = n;
  }

  function procCode(nature) {
    const n = String(nature || "");
    if (/cl[oô]ture/i.test(n)) return "cloture";
    if (/plan de cession/i.test(n)) return "plan_cession";
    if (/liquidation/i.test(n)) return "liquidation";
    if (/^jugement (de|modifiant le|arr[eê]tant le) plan/i.test(n)) return "sauvegarde";
    if (/redressement/i.test(n)) return "redressement";
    if (/sauvegarde/i.test(n)) return "sauvegarde";
    return n ? "autre" : "";
  }

  function labelFromCode(code) {
    if (code === "liquidation") return "Liquidation";
    if (code === "redressement") return "Redressement";
    if (code === "sauvegarde") return "Sauvegarde";
    if (code === "plan_cession") return "Plan de cession";
    if (code) return "Procédure";
    return "";
  }

  function latestProc(c) {
    const ev = (c.events || []).filter(function (e) { return e.code && e.code !== "autre"; });
    ev.sort(function (a, b) { return String(b.date || "").localeCompare(String(a.date || "")); });
    return ev[0] || null;
  }

  function refreshLabel(c) {
    const proc = latestProc(c);
    if (proc && proc.code !== "cloture") {
      c.label = labelFromCode(proc.code);
      c.kind = "procedure";
      c.nature = proc.nature || c.nature;
      c.jugementDate = proc.jugementDate || "";
      c.date = proc.date || c.date;
      c.tribunal = proc.tribunal || c.tribunal;
      c.complement = proc.complement || c.complement;
      c.url = proc.url || c.url;
      if (!c.source) c.source = "bodacc_collective";
      if ((c.listings || []).length) {
        const l = c.listings[0];
        c.vente_date = l.date || "";
        c.vente_prix = l.prix;
        c.vente_nature = l.nature || "";
        c.vente_role = l.cedant === c.siren ? "cedant" : l.acquereur === c.siren ? "acquereur" : "mention";
      }
      return;
    }
    if ((c.listings || []).length && proc == null) {
      const l = c.listings[0];
      c.label = "Cession";
      c.kind = "cession";
      c.date = c.date || l.date || "";
      c.url = c.url || l.url || "";
      c.vente_date = l.date || "";
      c.vente_prix = l.prix;
      c.vente_nature = l.nature || "";
      c.vente_role = l.cedant === c.siren ? "cedant" : l.acquereur === c.siren ? "acquereur" : "mention";
      if (!c.source) c.source = "bodacc_vente";
      return;
    }
    if (c.source === "sirene_cedant" || c.enriched) {
      if (!c.label) { c.label = "Cédant"; c.kind = "cedant"; }
    }
  }

  window.filonFusion = function (c, s) {
    if (!c || !s || !s.ok) return c;
    if (s.nom && !personLike(s.nom)) c.nom = s.nom.slice(0, 160);
    c.naf = s.naf || c.naf;
    c.section = s.section || c.section;
    c.te = s.effectif || c.te;
    c.categorie = s.categorie || c.categorie;
    c.creation = s.creation || c.creation;
    c.etat = s.etat || c.etat;
    if (s.etablissements != null) c.etablissements = s.etablissements;
    c.adresse = s.adresse || c.adresse;
    if (s.commune) c.commune = s.commune;
    if (s.dept) c.dept = s.dept;
    if (s.lat != null) c.lat = s.lat;
    if (s.lon != null) c.lon = s.lon;
    c.rge = !!s.rge;
    c.officers = s.officers || [];
    c.financials = s.financials || [];
    c.enriched = true;
    if (!c.source) c.source = "sirene_cedant";
    refreshLabel(c);
    return c;
  };

  function yearsSince(iso) {
    if (!/^\d{4}-\d{2}-\d{2}/.test(iso || "")) return null;
    const p = iso.slice(0, 10).split("-");
    const now = new Date();
    let y = now.getFullYear() - Number(p[0]);
    const m = now.getMonth() + 1 - Number(p[1]);
    if (m < 0 || (m === 0 && now.getDate() < Number(p[2]))) y--;
    return y;
  }

  function round1(n) { return (Math.round(n * 10) / 10).toFixed(1).replace(".", ","); }

  window.filonEvaluer = function (c) {
    c = c || {};
    const proc = latestProc(c);
    const procedure = proc && proc.code !== "autre" ? proc.code : "";
    const year = new Date().getFullYear();
    let age = null;
    (c.officers || []).forEach(function (o) {
      if (/commissaire/i.test(o.qualite || "") || !o.annee_naissance) return;
      const a = year - Number(o.annee_naissance);
      if (age == null || a > age) age = a;
    });
    const anciennete = yearsSince(c.creation);
    const fins = (c.financials || []).slice().sort(function (a, b) { return b.annee - a.annee; });
    const fin = fins[0] || {};
    const prev = fins[1] || {};
    const ca = typeof fin.ca === "number" ? fin.ca : null;
    const rn = typeof fin.resultat_net === "number" ? fin.resultat_net : null;
    const caPrev = typeof prev.ca === "number" ? prev.ca : null;
    const marge = ca > 0 && rn != null ? rn / ca : null;
    const naf = c.naf || "";
    const section = c.section || "";
    const te = c.te || "";
    const blocked = procedure === "cloture" || procedure === "autre";
    const signals = [];
    if (!blocked) {
      if (age >= 60) signals.push({ c: "cession", k: "dirigeant_60plus", l: "Dirigeant de " + age + " ans" });
      if (anciennete >= 20) signals.push({ c: "cession", k: "anciennete_20ans", l: "Entreprise de " + anciennete + " ans" });
      if (["redressement", "liquidation", "sauvegarde", "plan_cession"].indexOf(procedure) >= 0) signals.push({ c: "decote", k: "proc_" + procedure, l: proc.nature || procedure });
      if (rn < 0) signals.push({ c: "decote", k: "resultat_negatif", l: "Résultat net négatif (" + fin.annee + ")" });
      if (caPrev > 0 && ca != null && ca < caPrev * 0.85) signals.push({ c: "decote", k: "baisse_ca", l: "CA en baisse de " + Math.round((1 - ca / caPrev) * 100) + " %" });
      if (marge >= 0.08) signals.push({ c: "valeur", k: "marge_elevee", l: "Marge nette " + round1(marge * 100) + " %" });
      if (section === "F" || /^(33|43|81|38)\./.test(naf) || ["45.20A", "45.20B", "49.41A", "49.41B"].indexOf(naf) >= 0) signals.push({ c: "valeur", k: "secteur_fragmente", l: "Secteur fragmenté (build-up)" });
      if (c.rge) signals.push({ c: "valeur", k: "rge", l: "Certifié RGE" });
    }
    let score = null, p = null, d = null, q = null, v = null, vb = null, vh = null, rb = null, rh = null, cb = null, ch = null;
    if (!blocked && procedure !== "cloture") {
      const pAge = age >= 70 ? 90 : age >= 65 ? 80 : age >= 60 ? 65 : age >= 55 ? 35 : age == null ? 20 : 10;
      const pProc = procedure === "liquidation" ? 90 : procedure === "redressement" ? 85 : procedure === "plan_cession" ? 70 : procedure === "sauvegarde" ? 55 : 0;
      p = Math.min(100, Math.max(pAge, pProc) + (anciennete >= 20 ? 10 : 0));
      const dProc = procedure === "liquidation" ? 90 : procedure === "redressement" ? 80 : procedure === "sauvegarde" ? 60 : 0;
      d = Math.min(100, Math.max(20, dProc, rn < 0 ? 55 : 0, age >= 65 && !procedure ? 35 : 0) + (caPrev > 0 && ca != null && ca < caPrev * 0.85 ? 15 : 0));
      const margePts = marge == null ? 8 : marge >= 0.08 ? 25 : marge >= 0.03 ? 18 : marge >= 0 ? 10 : 3;
      const caPts = ca >= 5e6 ? 30 : ca >= 1e6 ? 25 : ca >= 3e5 ? 15 : ca > 0 ? 8 : 5;
      q = Math.min(100, Math.min(anciennete || 0, 30) / 30 * 35 + caPts + margePts + (te >= "11" && te !== "NN" ? 10 : 0));
      v = Math.min(100, (section === "F" || /^(33|43|81|38)\./.test(naf) ? 35 : 15) + (c.rge ? 15 : 0) + (te >= "02" && te <= "22" ? 20 : 0) + (ca >= 5e5 && ca <= 2e7 ? 20 : 0) + ((procedure === "redressement" || procedure === "sauvegarde") && ca >= 1e6 ? 10 : 0));
      score = Math.round(p * 0.30 + d * 0.25 + q * 0.25 + v * 0.20);
      if (ca > 0 || rn > 0) {
        const decLo = procedure === "liquidation" ? 0.10 : procedure === "redressement" ? 0.30 : procedure === "sauvegarde" ? 0.60 : 1;
        const decHi = procedure === "liquidation" ? 0.25 : procedure === "redressement" ? 0.50 : procedure === "sauvegarde" ? 0.80 : 1;
        const multLo = section === "F" ? 0.25 : (section === "C" || /^33\./.test(naf) ? 0.35 : 0.30);
        const multHi = section === "F" ? 0.50 : (section === "C" || /^33\./.test(naf) ? 0.70 : 0.60);
        rb = rn > 0 ? Math.round(rn * 4 * decLo) : null;
        rh = rn > 0 ? Math.round(rn * 7 * decHi) : null;
        cb = ca > 0 ? Math.round(ca * multLo * decLo) : null;
        ch = ca > 0 ? Math.round(ca * multHi * decHi) : null;
        const lo = rb != null ? rb : cb, hiL = cb != null ? cb : rb;
        const hi = rh != null ? rh : ch, hiH = ch != null ? ch : rh;
        vb = lo != null && hiL != null ? Math.round((lo + hiL) / 2) : null;
        vh = hi != null && hiH != null ? Math.round((hi + hiH) / 2) : null;
      }
    }
    return {
      score: score, p_cession: p, decote: d, qualite: q, potentiel: v,
      age: age, anciennete: anciennete, ca: ca, rn: rn, annee_fin: fin.annee || null, ca_prev: caPrev,
      procedure: procedure && procedure !== "cloture" && procedure !== "autre" ? procedure : (procedure === "cloture" ? "cloture" : ""),
      date_procedure: proc && proc.date || "",
      nature: proc && proc.nature || "",
      signals: signals, vb: vb, vh: vh, rb: rb, rh: rh, cb: cb, ch: ch
    };
  };

  function ingestBodaccRow(map, r) {
    const famille = r.familleavis;
    const j = jugementOf(r.jugement);
    if (famille === "collective" && /cl[oô]ture/i.test(j.nature)) return;
    const buyers = asList(r.listepersonnes, "personne");
    const sellers = asList(r.listeprecedentproprietaire, "personne").concat(asList(r.listeprecedentexploitant, "personne"));
    const sirens = [];
    function addSiren(s) { if (s && sirens.indexOf(s) < 0) sirens.push(s); }
    registreSirens(r.registre).forEach(addSiren);
    buyers.map(personneSiren).forEach(addSiren);
    sellers.map(personneSiren).forEach(addSiren);
    if (!sirens.length) return;
    const etabs = asList(r.listeetablissements, "etablissement");
    const acte = asObj(r.acte) || {};
    const prix = etabs.map(function (e) { return parsePrix(e && e.origineFonds); }).find(function (n) { return n != null; }) || null;
    const activite = etabs.map(function (e) { return e && e.activite; }).filter(Boolean).join(" · ").slice(0, 500);
    const commune = (etabs.map(function (e) { return e && e.adresse && e.adresse.ville; }).find(Boolean) || String(r.ville || "").split(",")[0] || "").trim();
    const natureVente = acte.vente && acte.vente.categorieVente ? String(acte.vente.categorieVente).slice(0, 200) : "";
    const href = safeUrl(r.url_complete);
    const buyer = buyers.map(personneSiren).find(Boolean) || "";
    const seller = sellers.map(personneSiren).find(Boolean) || "";
    sirens.forEach(function (siren) {
      const c = company(map, siren);
      const buyerNom = buyers.map(personneNom).find(Boolean);
      const sellerNom = sellers.map(personneNom).find(Boolean);
      if (siren === buyer) putNom(c, buyerNom);
      else if (siren === seller) putNom(c, sellerNom);
      else if (sirens.length === 1) putNom(c, r.commercant);
      buyers.forEach(function (p) { if (personneSiren(p) === siren) putNom(c, personneNom(p)); });
      if (!c.dept) c.dept = String(r.numerodepartement || "");
      if (!c.commune && commune) c.commune = commune.slice(0, 80);
      if (!c.cp && r.cp) c.cp = String(r.cp).slice(0, 5);
      if (famille === "collective") {
        c.events.push({
          date: String(r.dateparution || ""),
          nature: j.nature.slice(0, 180),
          jugementDate: j.date.slice(0, 48),
          tribunal: String(r.tribunal || "").replace(/\s+/g, " ").trim().slice(0, 160),
          url: href,
          complement: j.complement,
          code: procCode(j.nature),
          famille: "collective"
        });
        if (!c.source) c.source = "bodacc_collective";
      } else if (famille === "vente") {
        c.listings.push({
          date: String(r.dateparution || ""),
          titre: String(r.commercant || "").slice(0, 180),
          prix: prix,
          url: href,
          nature: natureVente,
          activite: activite,
          commune: commune.slice(0, 80),
          departement: String(r.numerodepartement || ""),
          acquereur: buyer,
          cedant: seller
        });
        if (!c.source) c.source = "bodacc_vente";
      }
      refreshLabel(c);
    });
  }

  function registreSirens(reg) {
    const arr = Array.isArray(reg) ? reg : (reg ? [reg] : []);
    const out = [];
    arr.forEach(function (item) {
      const s = sirenOf(item);
      if (s && out.indexOf(s) < 0) out.push(s);
    });
    return out;
  }

  function publish(map) {
    const out = [];
    map.forEach(function (c) {
      refreshLabel(c);
      const proc = latestProc(c);
      if (proc && proc.code === "cloture") return;
      if (!c.siren || !c.nom || !c.label) return;
      if (c.dept && DEPTS.indexOf(String(c.dept)) < 0) return;
      out.push(c);
    });
    const scored = out.map(function (c) {
      const s = window.filonEvaluer(c).score;
      return { c: c, s: s == null ? -1 : s };
    });
    scored.sort(function (a, b) {
      if (b.s !== a.s) return b.s - a.s;
      return String(b.c.date || "").localeCompare(String(a.c.date || ""));
    });
    return scored.map(function (x) { return x.c; });
  }

  function emit(rows, meta) {
    listeners.forEach(function (fn) { try { fn(rows, meta); } catch (e) {} });
  }

  async function buildCatalogue() {
    const map = new Map();
    const since = new Date(Date.now() - 90 * 864e5).toISOString().slice(0, 10);
    const deps = DEPTS.map(function (d) { return 'numerodepartement="' + d + '"'; }).join(" OR ");
    const where = '(familleavis="collective" OR familleavis="vente") AND (' + deps + ") AND dateparution>=date'" + since + "'";
    const select = "id,commercant,ville,cp,numerodepartement,dateparution,familleavis,jugement,url_complete,registre,tribunal,listepersonnes,listeprecedentproprietaire,listeprecedentexploitant,listeetablissements,acte";
    for (let page = 0; page < BODACC_PAGES; page++) {
      const url = API + "?limit=100&offset=" + (page * 100) + "&order_by=dateparution%20desc&select=" + select + "&where=" + encodeURIComponent(where);
      const data = await getJson(url);
      const results = data && data.results || [];
      if (!results.length) break;
      results.forEach(function (r) { ingestBodaccRow(map, r); });
      emit(publish(map), { phase: "bodacc" });
      if (results.length < 100) break;
    }
    const born = (new Date().getFullYear() - 60) + "-12-31";
    const keys = Object.keys(SECTEURS);
    for (let s = 0; s < keys.length; s++) {
      for (let page = 1; page <= CEDANT_PAGES; page++) {
        const url = SIRENE + "?activite_principale=" + encodeURIComponent(SECTEURS[keys[s]]) + "&region=11&tranche_effectif_salarie=03,11,12,21&etat_administratif=A&type_personne=dirigeant&date_naissance_personne_max=" + born + "&per_page=25&page=" + page;
        const data = await getJson(url);
        if (!data) break;
        (data.results || []).forEach(function (r) {
          const norm = normalizeEntreprise(r);
          if (!norm) return;
          if (norm.dept && DEPTS.indexOf(norm.dept) < 0) return;
          sireneCache.set(norm.siren, Promise.resolve(norm));
          const c = company(map, norm.siren);
          if (!c.source) c.source = "sirene_cedant";
          window.filonFusion(c, norm);
        });
        emit(publish(map), { phase: "cedants" });
        if (page >= (data.total_pages || 0)) break;
        await sleep(150);
      }
    }
    const rows = publish(map);
    emit(rows, { phase: "done" });
    return rows;
  }

  window.filonCatalogue = function (opts) {
    opts = opts || {};
    if (opts.force) catalogueJob = null;
    if (opts.onProgress) listeners.add(opts.onProgress);
    if (!catalogueJob) {
      catalogueJob = buildCatalogue().catch(function (err) { catalogueJob = null; throw err; });
    }
    return catalogueJob;
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
