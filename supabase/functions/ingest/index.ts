// PÉPITES — connecteurs d'ingestion (BODACC procédures et cessions, API Recherche d'entreprises)
// Auth : en-tête x-ingest-secret comparé à private.app_secrets (lu via service role).
import { createClient } from "npm:@supabase/supabase-js@2";

const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const IDF = ["75", "77", "78", "91", "92", "93", "94", "95"];
const RE_API = "https://recherche-entreprises.api.gouv.fr/search";
const BODACC_API = "https://bodacc-datadila.opendatasoft.com/api/explore/v2.1/catalog/datasets/annonces-commerciales/records";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function getJson(url: string, tries = 3): Promise<any> {
  for (let i = 0; i < tries; i++) {
    const r = await fetch(url, { headers: { "User-Agent": "pepites-mvp/0.1" } });
    if (r.status === 429) { await sleep(1500 * (i + 1)); continue; }
    if (!r.ok) throw new Error(`${r.status} ${url} ${(await r.text()).slice(0, 200)}`);
    return await r.json();
  }
  throw new Error("rate limited: " + url);
}

function toCompany(e: any, source: string) {
  const s = e.siege ?? {};
  return {
    siren: e.siren, nom: e.nom_raison_sociale ?? e.nom_complet, naf: e.activite_principale,
    section_naf: e.section_activite_principale, categorie: e.categorie_entreprise,
    tranche_effectif: e.tranche_effectif_salarie, nature_juridique: e.nature_juridique,
    date_creation: e.date_creation, etat_administratif: e.etat_administratif,
    departement: s.departement, code_postal: s.code_postal, commune: s.libelle_commune,
    adresse: s.adresse, latitude: s.latitude ? Number(s.latitude) : null,
    longitude: s.longitude ? Number(s.longitude) : null, nb_etablissements: e.nombre_etablissements_ouverts,
    est_rge: !!e.complements?.est_rge, source, enriched_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  };
}

async function saveEntreprise(e: any, source: string, keepSource = false) {
  const c: any = toCompany(e, source);
  if (keepSource) delete c.source;
  const { error } = await sb.from("companies").upsert(c);
  if (error) throw error;
  const officers = (e.dirigeants ?? []).filter((d: any) => d.type_dirigeant === "personne physique").map((d: any) => ({
    siren: e.siren, nom: d.nom, prenoms: d.prenoms ?? "", qualite: d.qualite ?? "",
    annee_naissance: d.annee_de_naissance ? Number(d.annee_de_naissance) : null, type_dirigeant: d.type_dirigeant,
  }));
  if (officers.length) await sb.from("officers").upsert(officers, { onConflict: "siren,nom,prenoms,qualite" });
  const fin = Object.entries(e.finances ?? {}).map(([annee, v]: any) => ({ siren: e.siren, annee: Number(annee), ca: v.ca, resultat_net: v.resultat_net }));
  if (fin.length) await sb.from("financials").upsert(fin);
}

// ---- 1. BODACC procédures collectives (hors clôtures) ----
async function ingestBodacc(p: any) {
  const depts: string[] = p.departements ?? IDF;
  const since = p.date_debut ?? new Date(Date.now() - 90 * 864e5).toISOString().slice(0, 10);
  const where = `familleavis="collective" AND (${depts.map((d) => `numerodepartement="${d}"`).join(" OR ")}) AND dateparution>=date'${since}'`;
  let offset = p.offset ?? 0, n = 0, seen = 0;
  const max = p.max ?? 500;
  while (seen < max) {
    const url = `${BODACC_API}?where=${encodeURIComponent(where)}&order_by=dateparution%20desc&limit=100&offset=${offset}`;
    const data = await getJson(url);
    const rows = data.results ?? [];
    if (!rows.length) break;
    const comps = new Map<string, any>(), evs: any[] = [];
    for (const r of rows) {
      const reg = Array.isArray(r.registre) ? r.registre[0] : r.registre;
      const siren = String(reg ?? "").replace(/\D/g, "").slice(0, 9);
      if (siren.length !== 9) continue;
      let j: any = {};
      try { j = typeof r.jugement === "string" ? JSON.parse(r.jugement) : (r.jugement ?? {}); } catch { /* */ }
      if (/cl[oô]ture/i.test(j.nature ?? "")) continue; // entreprise terminée : pas une cible
      comps.set(siren, { siren, nom: r.commercant, departement: r.numerodepartement, commune: r.ville, code_postal: r.cp, source: "bodacc_collective" });
      evs.push({
        id: r.id, siren, date_parution: r.dateparution, famille: r.familleavis, nature: j.nature ?? r.familleavis_lib,
        date_jugement: /^\d{4}-\d{2}-\d{2}$/.test(j.date ?? "") ? j.date : null, complement: j.complementJugement ?? null,
        tribunal: r.tribunal, url: r.url_complete, raw: r,
      });
    }
    if (comps.size) await sb.from("companies").upsert([...comps.values()], { onConflict: "siren", ignoreDuplicates: true });
    if (evs.length) { const { error } = await sb.from("legal_events").upsert(evs); if (error) throw error; }
    n += evs.length; seen += rows.length; offset += rows.length;
    if (rows.length < 100) break;
  }
  return { bodacc_events: n, next_offset: offset, total: undefined };
}

function asObj(v: unknown): any {
  if (v == null) return null;
  if (typeof v === "object") return v;
  if (typeof v !== "string" || !v) return null;
  try { return JSON.parse(v); } catch { return null; }
}

function asList(v: unknown, key: string): any[] {
  const o = asObj(v);
  if (!o) return [];
  const inner = o[key] ?? o;
  return Array.isArray(inner) ? inner : [inner];
}

function siren9(v: unknown): string | null {
  const digits = String(v ?? "").replace(/\D/g, "");
  return digits.length >= 9 ? digits.slice(0, 9) : null;
}

function registreSirens(reg: unknown): string[] {
  const arr = Array.isArray(reg) ? reg : reg ? [reg] : [];
  return [...new Set(arr.map(siren9).filter((s): s is string => !!s))];
}

function personneSiren(p: any): string | null {
  return siren9(p?.numeroImmatriculation?.numeroIdentification ?? p?.numeroIdentification);
}

function personneNom(p: any): string | null {
  const nom = p?.denomination || [p?.prenom ?? p?.prenoms, p?.nom].filter(Boolean).join(" ");
  return nom ? String(nom).slice(0, 200) : null;
}

// « prix stipulé de 450000,00 euros », « 155000.00 euros », « 1.450.000,00 euros »
function parsePrixFonds(text: string): number | null {
  const m = String(text ?? "").match(/prix[^0-9]{0,40}([0-9][0-9\s\u00a0.,]*)/i);
  if (!m) return null;
  let s = m[1].trim().replace(/[\s\u00a0]/g, "").replace(/[.,]+$/, "");
  if (/,\d{1,2}$/.test(s)) s = s.replace(/\./g, "").replace(/,\d{1,2}$/, "");
  else if (/\.\d{1,2}$/.test(s)) s = s.replace(/,/g, "").replace(/\.\d{1,2}$/, "");
  else s = s.replace(/[.,]/g, "");
  if (!/^\d+$/.test(s)) return null;
  const n = Number(s);
  if (!Number.isFinite(n) || n <= 0 || n > 1_000_000_000) return null;
  return n;
}

function bodaccRecordsUrl(where: string, offset: number): string {
  const url = new URL(BODACC_API);
  url.searchParams.set("where", where);
  url.searchParams.set("order_by", "dateparution desc");
  url.searchParams.set("limit", "100");
  url.searchParams.set("offset", String(offset));
  return url.toString();
}

// ---- 1b. BODACC ventes et cessions de fonds (prix publié) ----
async function ingestVentes(p: any) {
  const depts: string[] = (p.departements ?? IDF).filter((d: string) => /^\d{2,3}$/.test(String(d)));
  if (!depts.length) throw new Error("departements invalides");
  const since = String(p.date_debut ?? new Date(Date.now() - 90 * 864e5).toISOString().slice(0, 10));
  if (!/^\d{4}-\d{2}-\d{2}$/.test(since)) throw new Error("date_debut invalide");
  const where = `familleavis="vente" AND (${depts.map((d) => `numerodepartement="${d}"`).join(" OR ")}) AND dateparution>=date'${since}'`;
  let offset = Number(p.offset ?? 0) || 0, n = 0, avecPrix = 0, seen = 0;
  const max = p.max ?? 500;
  while (seen < max) {
    const data = await getJson(bodaccRecordsUrl(where, offset));
    const rows = data.results ?? [];
    if (!rows.length) break;
    const comps = new Map<string, any>();
    const listings = new Map<string, any>();
    for (const r of rows) {
      if (!r.id) continue;
      const buyers = asList(r.listepersonnes, "personne");
      const sellers = [...asList(r.listeprecedentproprietaire, "personne"), ...asList(r.listeprecedentexploitant, "personne")];
      const buyer = buyers.map(personneSiren).find(Boolean) ?? null;
      const seller = sellers.map(personneSiren).find(Boolean) ?? null;
      const sirens = [...new Set([buyer, seller, ...registreSirens(r.registre)].filter((s): s is string => !!s))];
      const etabs = asList(r.listeetablissements, "etablissement");
      const acte = asObj(r.acte) ?? {};
      const textes = etabs.map((e) => e?.origineFonds).filter(Boolean);
      const prix = textes.map(parsePrixFonds).find((x) => x != null) ?? null;
      const activite = etabs.map((e) => e?.activite).filter(Boolean).join(" · ").slice(0, 500) || null;
      const commune = etabs.map((e) => e?.adresse?.ville).find(Boolean) || (r.ville ? String(r.ville).split(",")[0].trim() : null);
      const nature = acte?.vente?.categorieVente ? String(acte.vente.categorieVente).slice(0, 200) : r.familleavis_lib ?? null;
      const buyerNom = buyers.map(personneNom).find(Boolean);
      const sellerNom = sellers.map(personneNom).find(Boolean);
      for (const siren of sirens) {
        const nom = siren === buyer ? buyerNom : siren === seller ? sellerNom : null;
        comps.set(siren, {
          siren,
          nom: nom ?? (sirens.length === 1 ? String(r.commercant ?? "").slice(0, 200) || null : null),
          departement: r.numerodepartement, commune, code_postal: r.cp ? String(r.cp).slice(0, 5) : null,
          source: "bodacc_vente",
        });
      }
      const titre = [r.commercant, nature].filter(Boolean).join(" — ").slice(0, 300);
      listings.set(r.id, {
        external_id: r.id,
        siren: buyer,
        siren_cedant: seller && seller !== buyer ? seller : null,
        sirens,
        source: "bodacc_vente",
        titre: titre || null,
        prix_demande: prix,
        url: typeof r.url_complete === "string" && r.url_complete.startsWith("https://") ? r.url_complete : null,
        date_parution: /^\d{4}-\d{2}-\d{2}$/.test(r.dateparution ?? "") ? r.dateparution : null,
        departement: r.numerodepartement ?? null,
        commune: commune ? String(commune).slice(0, 120) : null,
        activite,
        nature,
        raw: r,
      });
      if (prix != null) avecPrix++;
    }
    const listingRows = [...listings.values()];
    if (comps.size) {
      const { error } = await sb.from("companies").upsert([...comps.values()], { onConflict: "siren", ignoreDuplicates: true });
      if (error) throw error;
    }
    if (listingRows.length) {
      const { error } = await sb.from("listings").upsert(listingRows, { onConflict: "external_id" });
      if (error) throw error;
    }
    n += listingRows.length; seen += rows.length; offset += rows.length;
    if (rows.length < 100) break;
  }
  return { ventes: n, ventes_avec_prix: avecPrix, next_offset: offset };
}

// ---- 2. Enrichissement Sirene/RNE via API Recherche d'entreprises ----
async function enrich(p: any) {
  const { data: todo } = await sb.from("companies").select("siren").is("enriched_at", null).limit(p.batch ?? 60);
  let ok = 0;
  for (const { siren } of todo ?? []) {
    try {
      const d = await getJson(`${RE_API}?q=${siren}&per_page=1`);
      const e = (d.results ?? []).find((x: any) => x.siren === siren);
      if (e) { await saveEntreprise(e, "", true); ok++; }
      else await sb.from("companies").update({ enriched_at: new Date().toISOString() }).eq("siren", siren);
    } catch (err) { console.error(siren, String(err)); }
    await sleep(170);
  }
  return { enriched: ok, batch: todo?.length ?? 0 };
}

// ---- 3. Cédants potentiels : dirigeants 60+ dans un secteur cible ----
async function cedants(p: any) {
  const naf = p.naf ?? "43.21A,43.22A,43.22B,43.29A,43.32A,43.34Z,43.91B,33.12Z,33.14Z,33.20C";
  const born = p.ne_avant ?? `${new Date().getFullYear() - 60}-12-31`;
  let n = 0;
  for (let page = p.page_debut ?? 1; page < (p.page_debut ?? 1) + (p.pages ?? 8); page++) {
    const url = `${RE_API}?activite_principale=${naf}&region=${p.region ?? "11"}&tranche_effectif_salarie=${p.effectifs ?? "03,11,12,21"}&etat_administratif=A&type_personne=dirigeant&date_naissance_personne_max=${born}&per_page=25&page=${page}`;
    const d = await getJson(url);
    for (const e of d.results ?? []) { await saveEntreprise(e, "sirene_cedant"); n++; }
    if (page >= (d.total_pages ?? 0)) break;
    await sleep(200);
  }
  return { cedants: n };
}

Deno.serve(async (req) => {
  const { data: secret } = await sb.rpc("get_ingest_secret");
  if (!secret || req.headers.get("x-ingest-secret") !== secret) return new Response("forbidden", { status: 403 });
  const p = await req.json().catch(() => ({}));
  const mode = p.mode ?? "all";
  const { data: log } = await sb.from("sources_log").insert({ source: mode, params: p, statut: "running" }).select("id").single();
  try {
    const out: any = {};
    if (mode === "bodacc" || mode === "all") Object.assign(out, await ingestBodacc(p));
    if (mode === "ventes") Object.assign(out, await ingestVentes(p));
    if (mode === "cedants" || mode === "all") Object.assign(out, await cedants(p));
    if (mode === "enrich" || mode === "all") Object.assign(out, await enrich(p));
    const { data: scored, error: se } = await sb.rpc("compute_scores");
    out.scored = se ? "erreur: " + se.message : scored;
    await sb.from("sources_log").update({ statut: "ok", nb_items: out.ventes ?? out.bodacc_events ?? out.cedants ?? out.enriched ?? 0, message: JSON.stringify(out), finished_at: new Date().toISOString() }).eq("id", log!.id);
    return Response.json(out);
  } catch (err) {
    await sb.from("sources_log").update({ statut: "error", message: String((err as any)?.message ?? err), finished_at: new Date().toISOString() }).eq("id", log!.id);
    return Response.json({ error: String(err) }, { status: 500 });
  }
});
