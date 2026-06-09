-- ============================================================
-- RadioAudit — Migration : rôles + authentification + assignation
-- À exécuter dans Supabase → SQL Editor
-- ============================================================

-- 1) Rôle et mot de passe (hash SHA-256) sur les ingénieurs
alter table ingenieurs add column if not exists role text default 'Agent';
alter table ingenieurs add column if not exists pwd_hash text;
-- valeurs de role : 'Admin' | 'Manager' | 'Agent'

-- 2) Ingénieurs assignés à une mission (en plus du responsable)
--    NB : missions.id et ingenieurs.id sont de type text (UUID stockés en texte)
create table if not exists mission_engineers (
  mission_id   text references missions(id)   on delete cascade,
  ingenieur_id text references ingenieurs(id) on delete cascade,
  primary key (mission_id, ingenieur_id)
);

-- 3) Badji = Admin, avec un mot de passe temporaire = "Radio2026"
--    (à changer immédiatement depuis le panneau Admin > Ingénieurs)
update ingenieurs
   set role = 'Admin',
       pwd_hash = 'ec7e532bdb5cee6e13d57dfa843fc201d0a2f78b49a1b6d11e38d3735d6644b4'
 where login = 'badji028350';

-- 4) Droits (POC, RLS désactivée)
grant all on mission_engineers to anon, authenticated;
