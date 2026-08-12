# SECURITE.md
## Règles de sécurité — Plateforme "Le Fanion"

> Document nouveau en v2 (n'existait pas pour l'app de bureau mono-poste v1). À charger avec `CONTEXTE_ANTIGRAVITY.md` et `REGLES_TECHNIQUES.md`. L'agent IA doit refuser d'implémenter une fonctionnalité qui contournerait une règle de ce document, même si demandé explicitement — signaler le conflit plutôt que d'obéir silencieusement.

---

## 1. Principe fondamental

**La sécurité n'est jamais garantie par l'interface, toujours par la base de données.** Un écran qui "cache" un bouton n'empêche personne de rien si la donnée reste accessible par un autre chemin (appel API direct, outil de développeur du navigateur, etc.). Toute règle de permission doit être appliquée via les **policies Row Level Security (RLS) de PostgreSQL/Supabase**, pas seulement en conditionnant l'affichage React.

---

## 2. Comptes utilisateurs

### 2.1 Aucune inscription publique
Il ne doit jamais exister d'écran ou de canal API permettant à quelqu'un de créer lui-même un compte. La création de compte est **exclusivement** déclenchée par un `principal` ou un `directeur_etudes`, via Supabase Auth (invitation par email).

### 2.2 Un compte = un rôle unique
Chaque compte (`profiles`) porte un seul rôle (`principal`, `directeur_etudes`, `enseignant`). Pas de cumul de rôles multiples sur un même compte — si une personne change de fonction, son rôle est modifié, pas additionné.

### 2.3 Désactivation immédiate
La désactivation d'un compte enseignant doit couper l'accès **immédiatement** (révocation de session), pas seulement empêcher une future connexion. L'historique des notes déjà saisies par cet enseignant reste intact et attribué à son nom (traçabilité), même après désactivation.

---

## 3. Permissions par rôle (Row Level Security)

### 3.1 Principal / Directeur des Études
Policy RLS : lecture et écriture autorisées sur toutes les tables métier, sans restriction de division (accès Collège + Primaire confirmé pour les deux rôles).

### 3.2 Enseignant
Policy RLS sur la table `grades` (et toute table de notes) : un enseignant ne peut lire/écrire une ligne que si une entrée correspondante existe dans `teacher_assignments` pour `(teacher_id = auth.uid(), subject_id, class_id)` correspondant à l'élève concerné.

**Aucun accès** aux tables suivantes pour le rôle `enseignant` : `payments`, `fee_schedules`, `student_fee_overrides`, `receipts` (module Finance entier hors périmètre).

**Accès en lecture seule** aux informations administratives de base des élèves de ses classes assignées uniquement (nom, prénom — pas nécessairement le dossier complet).

### 3.3 Séparation des divisions
Toute table portant `division_id` (directement ou via jointure classe) applique une policy RLS filtrant selon le rôle : pour `enseignant`, restriction supplémentaire à la division de ses classes assignées.

---

## 4. Règles de développement liées à la sécurité

- **Ne jamais faire confiance à une donnée envoyée par le client** (bureau ou web) sans revalidation côté service/base. Un `teacher_assignments` vérifié uniquement côté React est un trou de sécurité.
- **Toute nouvelle table métier doit avoir sa policy RLS écrite en même temps que sa migration**, jamais après coup ni "à ajouter plus tard".
- **Tester chaque nouvelle policy avec un compte enseignant réel** (pas seulement avec le compte admin/service) avant de considérer une fonctionnalité terminée — l'agent doit explicitement proposer ce test dans son plan de vérification.
- **Les clés API Supabase publiques (anon key) ne donnent aucun accès par défaut** — tout accès doit passer par une policy RLS explicite ; l'absence de policy sur une table doit bloquer l'accès, pas l'ouvrir.

---

## 5. Fichiers (Supabase Storage)

- Bucket photos élèves : accès en lecture restreint aux utilisateurs authentifiés de la division concernée ; écriture réservée à `principal`/`directeur_etudes`.
- Bucket reçus PDF / bulletins générés : mêmes règles, jamais d'URL publique permanente sans expiration pour un document contenant des données personnelles ou financières.

---

## 6. Ce qui ne change pas de la v1

- Numérotation séquentielle des reçus jamais réutilisée (traçabilité financière).
- Soft-delete des élèves (`status`), jamais de suppression physique si des données liées existent (paiements, notes).
- Toute mutation multi-tables reste transactionnelle.

---

## 7. Signal d'alerte pour l'agent IA

Si une demande implique une des situations suivantes, l'agent doit s'arrêter et demander confirmation explicite avant d'implémenter :
- Donner un accès plus large à un rôle que ce que ce document décrit.
- Créer un chemin d'accès aux données qui ne passe pas par une policy RLS vérifiée.
- Stocker un mot de passe, une clé secrète, ou un token en clair dans le code, un fichier de log, ou une table non chiffrée.
- Désactiver ou contourner temporairement une policy RLS "pour tester plus vite" sans la réactiver immédiatement après.