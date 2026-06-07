# RadioAudit — Orange Sonatel

Audit terrain des sites radio. PWA offline-first, backend Supabase (POC), modèle **mission-centric**.

## Modèle
- **Mission** = campagne (périmètre = liste de sites + dates + statut).
- **Visite** = 1 ingénieur audite 1 site à 1 date, **dans une mission**.
- Une visite porte : relevés par secteur (azimuth réf base vs terrain → écart), actions, médias.
- Secteurs = référence (base) + secteurs **ajoutés terrain** (origine = terrain).

## Pré-requis Supabase
1. `radioaudit_schema.sql` (tables de base) — déjà fait.
2. `radioaudit_migration_missions.sql` (missions, mission_sites, visites.mission_id, secteurs.origine).
3. Si erreur 401 : exécuter les `grant…` (cf. message). URL + clé publiable déjà câblées dans `db.js`.

## Déploiement
Tous les fichiers du dossier ensemble (GitHub Pages ou serveur local `python -m http.server`). Libs bundlées localement.

## Flux
1. Login ingénieur.
2. **Sélecteur de mission** → créer une mission (nom, dates, responsable + **choix des sites** du périmètre) ou en sélectionner une.
3. Carte/liste **scopées à la mission**, avec taux de couverture (audités / périmètre).
4. Tap d'un site → historique + **Nouvelle visite** (mission rattachée auto) :
   - identification, pylône, GPS terrain (écart à la base) ;
   - **config commune** HBA + type antenne (appliquée à tous les secteurs, surchargeable) ;
   - relevés par secteur avec **écart azimuth** en direct ;
   - **+ Ajouter un secteur** trouvé sur place (origine terrain).

## Fait jusqu'ici
Référentiel + carte ; missions (périmètre par sélection/import liste) ; fiche de visite (relevés secteur + écart azimuth, GPS, config commune HBA/type, ajout secteur terrain) ; **photos/vidéos (IndexedDB local) + actions/recommandations**.

## À venir
Dashboard de pilotage ; exports PPT/Excel ; upload médias cloud (optionnel) ; sync hors-ligne.

## Fichiers
`index.html` (app) · `db.js` (couche données, backend-agnostique) · `sw.js` / `manifest.json` (PWA) · libs `*.min.js`/`*.css`.
