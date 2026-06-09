/* =====================================================================
   RadioAudit — Couche d'accès données (BACKEND-AGNOSTIQUE)
   ---------------------------------------------------------------------
   Cible actuelle : Supabase (PostgREST, via fetch — pas de SDK).
   Migration PocketBase = on réécrit CE SEUL fichier, le reste de l'app
   ne touche jamais le backend directement.

   Clés :
   - sites/secteurs  -> id = clé naturelle (nom_site / nom_secteur)
     => ré-import idempotent, pas d'orphelins.
   - ingenieurs/porteurs/visites/releves/actions/medias -> id = UUID
     (DB.uuid()) généré côté client => création possible hors-ligne.
   ===================================================================== */
const DB = (() => {
  const SUPABASE_URL = 'https://huidrduzzlaoghdiehee.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_44PBoHhO8ykLIXkd9z5FwQ_RmX8jk_Y';
  const REST = SUPABASE_URL + '/rest/v1/';

  const uuid = () =>
    (crypto.randomUUID ? crypto.randomUUID()
      : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
          const r = Math.random() * 16 | 0;
          return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
        }));

  const headers = (extra = {}) => Object.assign({
    'apikey': SUPABASE_KEY,
    'Authorization': 'Bearer ' + SUPABASE_KEY,
    'Content-Type': 'application/json'
  }, extra);

  async function _fetch(path, opts = {}) {
    const res = await fetch(REST + path, opts);
    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      throw new Error('Supabase ' + res.status + ' : ' + txt.slice(0, 300));
    }
    const ct = res.headers.get('content-type') || '';
    return ct.includes('application/json') ? res.json() : null;
  }

  const select  = (table, q = 'select=*') => _fetch(`${table}?${q}`, { headers: headers() });
  const insert  = (table, rows)           => _fetch(table, { method: 'POST', headers: headers({ 'Prefer': 'return=representation' }), body: JSON.stringify(rows) });
  const upsert  = (table, rows, onConf)   => _fetch(`${table}?on_conflict=${onConf}`, { method: 'POST', headers: headers({ 'Prefer': 'resolution=merge-duplicates,return=minimal' }), body: JSON.stringify(rows) });
  const update  = (table, id, patch)      => _fetch(`${table}?id=eq.${encodeURIComponent(id)}`, { method: 'PATCH', headers: headers({ 'Prefer': 'return=representation' }), body: JSON.stringify(patch) });
  const remove  = (table, id)             => _fetch(`${table}?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE', headers: headers() });

  /* lecture paginée : récupère TOUTES les lignes (Supabase plafonne à 1000/req) */
  async function selectAll(table, q = 'select=*', pageSize = 1000) {
    let out = [], off = 0;
    for (;;) {
      const page = await _fetch(`${table}?${q}&limit=${pageSize}&offset=${off}`, { headers: headers() });
      if (!page || !page.length) break;
      out = out.concat(page);
      if (page.length < pageSize) break;
      off += pageSize;
      if (off > 200000) break; // garde-fou
    }
    return out;
  }

  async function insertBatched(table, rows, { onConflict = null, size = 500, onProgress = null } = {}) {
    for (let i = 0; i < rows.length; i += size) {
      const chunk = rows.slice(i, i + size);
      if (onConflict) await upsert(table, chunk, onConflict);
      else            await insert(table, chunk);
      if (onProgress) onProgress(Math.min(i + size, rows.length), rows.length);
    }
  }

  /* test de connectivité (utilisé par l'indicateur réseau) */
  async function ping() {
    try { await select('porteurs', 'select=code&limit=1'); return true; }
    catch (e) { console.warn('ping KO', e); return false; }
  }

  return {
    uuid, ping,
    config: { url: SUPABASE_URL },

    /* ---------- RÉFÉRENTIEL ---------- */
    getSites:    ()    => selectAll('sites', 'select=*&order=nom_site'),
    getSecteurs: (sid) => selectAll('secteurs', sid ? `select=*&site_id=eq.${encodeURIComponent(sid)}&order=nom_secteur` : 'select=*&order=nom_secteur'),

    getIngenieurs:   ()      => select('ingenieurs', 'select=*&order=nom_complet'),
    getIngByLogin:   (login) => select('ingenieurs', 'select=*&login=eq.' + encodeURIComponent(login)),
    addIngenieur:    (o)     => insert('ingenieurs', Object.assign({ id: uuid() }, o)),
    updateIngenieur: (id, p) => update('ingenieurs', id, p),
    delIngenieur:    (id)    => remove('ingenieurs', id),

    getPorteurs:   ()      => select('porteurs', 'select=*&order=code'),
    addPorteur:    (o)     => insert('porteurs', Object.assign({ id: uuid() }, o)),
    updatePorteur: (id, p) => update('porteurs', id, p),
    delPorteur:    (id)    => remove('porteurs', id),

    /* ---------- IMPORT BASE (sites + secteurs, idempotent) ---------- */
    async importBase(sitesArr, secteursArr, onProgress) {
      onProgress && onProgress('Sites', 0, sitesArr.length);
      await insertBatched('sites', sitesArr, { onConflict: 'nom_site', onProgress: (d, t) => onProgress && onProgress('Sites', d, t) });
      onProgress && onProgress('Secteurs', 0, secteursArr.length);
      await insertBatched('secteurs', secteursArr, { onConflict: 'nom_secteur', onProgress: (d, t) => onProgress && onProgress('Secteurs', d, t) });
    },

    /* ---------- OPÉRATIONNEL (incréments suivants) ---------- */
    getVisites:  (sid) => selectAll('visites', sid ? `select=*&site_id=eq.${encodeURIComponent(sid)}&order=date_visite.desc` : 'select=*&order=date_visite.desc'),
    saveVisite:  (o)   => o.id ? update('visites', o.id, o) : insert('visites', Object.assign({ id: uuid() }, o)),
    getReleves:  (vid) => select('releves_secteur', `select=*&visite_id=eq.${encodeURIComponent(vid)}`),
    saveReleve:  (o)   => o.id ? update('releves_secteur', o.id, o) : insert('releves_secteur', Object.assign({ id: uuid() }, o)),
    getActions:  (q)   => selectAll('actions', q || 'select=*&order=created_at.desc'),
    saveAction:  (o)   => o.id ? update('actions', o.id, o) : insert('actions', Object.assign({ id: uuid() }, o)),
    delAction:   (id)  => remove('actions', id),

    /* ---------- MÉDIAS (références ; binaire en IndexedDB local) ---------- */
    getMedias:   (vid) => selectAll('medias', `select=*&visite_id=eq.${encodeURIComponent(vid)}&order=created_at`),
    saveMedia:   (o)   => insert('medias', Object.assign({ id: uuid() }, o)),
    delMedia:    (id)  => remove('medias', id),

    /* ---------- MISSIONS ---------- */
    getMissions:       ()      => select('missions', 'select=*&order=created_at.desc'),
    saveMission:       (o)     => o.id ? update('missions', o.id, o) : insert('missions', Object.assign({ id: uuid() }, o)),
    delMission:        (id)    => remove('missions', id),
    getMissionSiteIds: (mid)   => selectAll('mission_sites', `select=site_id&mission_id=eq.${encodeURIComponent(mid)}&order=site_id`),
    getAllMissionSites: ()     => selectAll('mission_sites', 'select=mission_id,site_id&order=mission_id'),
    async setMissionSites(mid, siteIds) {
      await _fetch(`mission_sites?mission_id=eq.${encodeURIComponent(mid)}`, { method: 'DELETE', headers: headers() });
      if (siteIds.length) await insertBatched('mission_sites', siteIds.map(s => ({ mission_id: mid, site_id: s })), { size: 500 });
    },
    getAllMissionEngineers: () => selectAll('mission_engineers', 'select=mission_id,ingenieur_id'),
    getMissionEngineers:    (mid) => selectAll('mission_engineers', `select=ingenieur_id&mission_id=eq.${encodeURIComponent(mid)}`),
    async setMissionEngineers(mid, engIds) {
      await _fetch(`mission_engineers?mission_id=eq.${encodeURIComponent(mid)}`, { method: 'DELETE', headers: headers() });
      if (engIds.length) await insertBatched('mission_engineers', engIds.map(e => ({ mission_id: mid, ingenieur_id: e })), { size: 500 });
    },

    /* secteur ajouté sur le terrain (origine = terrain) */
    addSecteur: (o) => upsert('secteurs', Object.assign({ id: o.nom_secteur }, o), 'nom_secteur'),

    /* échappatoire bas-niveau si besoin */
    raw: { select, insert, upsert, update, remove, insertBatched }
  };
})();
