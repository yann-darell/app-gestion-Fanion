# Spécification de conception : Refonte Navigation et Contrôle d'Accès par Rôle (RBAC)

- **Date** : 2026-08-17
- **Auteur** : Antigravity
- **Statut** : Validé

---

## 1. Objectif
Harmoniser et centraliser la gestion de la navigation et de la sécurité d'accès aux routes au sein des applications Desktop et Web de *Le Fanion*. 
Actuellement, chaque vue gère sa propre visibilité par rôle et les menus latéraux (`Sidebar.tsx`) affichent toutes les entrées même pour des rôles non autorisés (ex. `enseignant`). 

Cette refonte met en place :
1. Une source de vérité unique pour la navigation dans `packages/shared/config/navigation.ts`.
2. Le filtrage dynamique des éléments du menu latéral dans `Sidebar.tsx` (Desktop & Web).
3. Une protection d'accès aux routes via un garde de routage (`ProtectedRoute`) évitant toute navigation directe par URL non autorisée.
4. Une gestion propre du rôle `enseignant` à ce stade du projet (affichage du message *"Aucun module disponible pour le moment"* et redirection vers un écran d'accueil d'attente).

---

## 2. Rôles applicatifs autorisés

Seuls les trois (3) rôles suivants existent dans la base de données et dans l'application :
- `principal` (Proviseur)
- `directeur_etudes` (Directeur des études)
- `enseignant` (Enseignant)

Aucun autre rôle (ex: `comptable`) n'est introduit ou géré.

---

## 3. Configuration de la Navigation (`packages/shared/config/navigation.ts`)

Un fichier centralisé définit la liste de toutes les entrées de navigation avec la structure TypeScript suivante :

```typescript
export interface NavItemConfig {
  id: string;
  to: string;
  label: string;
  allowedRoles: string[];
}
```

### Table des autorisations de routes :

| ID / Route | Label | Rôles autorisés (`allowedRoles`) |
| :--- | :--- | :--- |
| `/students` | Élèves | `['principal', 'directeur_etudes']` |
| `/classes` | Classes | `['principal', 'directeur_etudes']` |
| `/subjects` | Matières | `['principal', 'directeur_etudes']` |
| `/subjects/coefficients` | Coefficients | `['principal', 'directeur_etudes']` |
| `/assignments` | Attributions | `['principal', 'directeur_etudes']` |
| `/assignments/overview` | Vue d'ensemble | `['principal', 'directeur_etudes']` |
| `/users` | Gestion Comptes | `['principal', 'directeur_etudes']` |
| `/grades` | Bulletins & Notes | `['principal', 'directeur_etudes']` |
| `/finance` | Finance & Scolarité | `['principal', 'directeur_etudes']` |
| `/settings` | Paramètres | `['principal', 'directeur_etudes']` |

> **Comportement Enseignant** : Le rôle `enseignant` n'ayant aucune route d'administration attribuée avant le Lot D3, le filtrage renvoie une liste vide.

---

## 4. Composants et Modifications

### 4.1. Configuration Shared (`packages/shared/config/navigation.ts` et `packages/shared/index.ts`)
- Création du fichier de config `navigation.ts` contenant `NAVIGATION_ITEMS` et la fonction utilitaire `getNavItemsForRole(role?: string)`.
- Export de la configuration dans `packages/shared/index.ts`.

### 4.2. Refonte de `Sidebar.tsx` (Desktop et Web)
- Remplacement du tableau local de navigation par l'appel à `getNavItemsForRole(userRole)`.
- En cas de liste vide (rôle `enseignant`), rendu d'un bloc informatif et soigné dans la sidebar :
  ```tsx
  <div className="p-4 text-center text-xs text-slate-400 italic">
    Aucun module disponible pour le moment
  </div>
  ```

### 4.3. Contrôle d'accès et Protection des Routes (`ProtectedRoute`)
- Création d'un composant de garde de route `ProtectedRoute` (utilisé dans `App.tsx` pour Desktop et Web).
- Logique de garde :
  - Si le rôle de l'utilisateur fait partie des `allowedRoles` de la route : rendu de la page (`<Outlet />` ou composant de page).
  - Sinon : redirection propre vers l'écran d'accueil `/` (Option A).
- Page d'accueil `/` :
  - Pour les rôles direction (`principal`, `directeur_etudes`) : redirection automatique par défaut vers `/students`.
  - Pour le rôle `enseignant` : affichage d'un écran d'accueil dédié indiquant *"Aucun module disponible pour le moment"*.

---

## 5. Plan de Vérification & Recette de Test avec le Compte Enseignant

1. **Connexion avec le compte Enseignant** :
   - Vérifier que la `Sidebar` (Desktop et Web) est totalement vide de liens d'administration et affiche le message *"Aucun module disponible pour le moment"*.
   - Vérifier que l'écran principal affiche un message d'accueil clair indiquant qu'aucun module n'est disponible à ce stade.
2. **Test de navigation directe par URL (Hack URL)** :
   - Taper directement `/students`, `/classes`, `/users`, `/finance` etc. dans la barre d'adresse.
   - Constater la redirection immédiate et propre vers `/` sans erreur ni écran blanc.
3. **Connexion avec un compte Direction (`principal` / `directeur_etudes`)** :
   - Vérifier que la navigation complète s'affiche correctement et que toutes les routes restent accessibles normalement.
