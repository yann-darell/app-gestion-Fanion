# REGLES_TECHNIQUES.md (v2)
## Règles de développement — Plateforme "Le Fanion"

> À charger avec `CONTEXTE_ANTIGRAVITY.md` et `SECURITE.md`. Remplace la version v1 (mono-poste). L'agent IA doit refuser d'écrire du code front tant que la couche back/Supabase correspondante (table, policy RLS, fonction) n'existe pas et n'est pas testée.

---

## 1. Règle d'or : Données → Sécurité → API → Front, jamais l'inverse

Pour chaque fonctionnalité, ordre non négociable :

1. **Migration SQL** (table PostgreSQL, via Supabase)
2. **Policy RLS** correspondante — écrite en même temps que la table, jamais après (voir `SECURITE.md` §4)
3. **Fonction/service métier** si logique complexe (ex : allocation de paiement par tranche, calcul de moyenne) — centralisée, testée isolément
4. **Test manuel de l'accès** avec un compte de chaque rôle concerné (pas seulement le compte admin)
5. **Client API** (wrapper autour de `@supabase/supabase-js`), utilisé identiquement par le bureau et le web
6. **Front** : hook de données, puis composants/pages

**Aucune exception** : contrairement à la v1 où le mono-poste tolérait un peu de laxisme, une policy RLS oubliée en v2 est une vraie faille de sécurité exploitable à distance.

---

## 2. Deux clients, un seul cœur de logique

L'application de bureau (Electron) et la plateforme web partagent la même base Supabase et, autant que possible, le même code de logique métier (hooks, validation zod, appels API) — seule la couche de présentation (layout, navigation) diffère.

Convention de dossier proposée :
```
packages/
├── shared/                # logique partagée bureau + web
│   ├── api/                # wrapper Supabase, une fonction par opération métier
│   ├── hooks/               # hooks de données réutilisables
│   ├── validation/           # schémas zod partagés
│   └── types/                # types générés depuis le schéma Supabase
├── desktop/                # Electron, spécifique bureau
│   └── src/pages, components/ui, components/layout...
└── web/                    # plateforme web, spécifique web
    └── src/pages, components/ui, components/layout...
```

**Design system dupliqué ou partagé ?** Recommandé : dupliquer les composants `ui/` entre `desktop` et `web` au départ (plus simple, moins de risque de régression croisée), mutualiser seulement si la duplication devient un vrai fardeau constaté — ne pas sur-ingénierier un monorepo partagé dès le premier lot.

---

## 3. Convention de dossier interne (reprise de la v1, inchangée)

Une feature = un dossier autonome avec sa page, ses composants locaux, ses hooks locaux :
```
src/pages/students/
├── StudentsListPage.tsx
├── components/
│   ├── StudentRow.tsx
│   └── NewStudentModal.tsx
└── hooks/
    └── useStudentsList.ts
```
Un composant ne monte dans `components/ui/` global que lorsqu'une **deuxième page** en a besoin (règle "rule of two").

---

## 4. Priorité mobile pour le web

Toute page du client `web` destinée à un usage enseignant (en particulier la saisie de notes) doit être **développée et testée d'abord en largeur mobile** (~375px), puis élargie pour desktop — pas l'inverse. Utiliser les classes responsive Tailwind (`sm:`, `md:`, `lg:`) systématiquement, jamais de largeur fixe en pixels sur un conteneur principal.

---

## 5. Règles de qualité obligatoires

- Zéro `any` sans justification commentée.
- Zéro logique métier dans un composant `.tsx`.
- Zéro requête Supabase brute en dehors de la couche `api/`.
- Toute mutation multi-tables reste transactionnelle (fonctions PostgreSQL / RPC Supabase si nécessaire pour garantir l'atomicité, plutôt que plusieurs appels séquentiels côté client).
- Un commit = une feature ou un fix, jamais un mélange.
- **Chaque nouvelle table testée avec un compte de test par rôle avant de passer au front** (voir `SECURITE.md`).

---

## 6. Ordre de développement global (macro), aligné sur le cahier des charges

| Lot | Contenu | Validation avant de continuer |
|---|---|---|
| A. Fondation | Projet Supabase, tables organisation (divisions, school_years, classes), authentification, policies RLS de base | Connexion possible avec un compte de test par rôle |
| B. Élèves | Migration depuis la logique v1, adaptée à Supabase Storage pour les photos | CRUD élève fonctionnel, RLS vérifiée |
| C. Notes | Matières, coefficients, attributions enseignants, saisie | Un compte enseignant ne voit que son périmètre (test réel, pas supposé) |
| D. Bulletins | Exploitation des fichiers Word réels | Génération d'un bulletin réel |
| E. Finance | Tarifs, allocation par tranche, reçus avec logo | Paiement réparti correctement, reçu généré et lisible |
| F. Fournitures | Double mode physique/monétaire | Suivi par élève fonctionnel |
| G. Web responsive | Interface mobile-first complète | Saisie de notes testée sur un vrai téléphone |

**Priorité de présentation immédiate confirmée par le client** : Élèves → Finance (avec reçu+logo) → Bulletins (si le fichier Word est prêt).

---

## 7. Ce que l'agent IA doit faire en cas de doute

Si une instruction contredit ce document ou `SECURITE.md`, signaler explicitement la contradiction et proposer un choix, plutôt que de trancher silencieusement — en particulier pour tout ce qui touche aux permissions par rôle.