export interface NavItemConfig {
  id: string;
  to: string;
  label: string;
  allowedRoles: string[];
}

export const NAVIGATION_ITEMS: NavItemConfig[] = [
  {
    id: "students",
    to: "/students",
    label: "Élèves",
    allowedRoles: ["principal", "directeur_etudes"],
  },
  {
    id: "classes",
    to: "/classes",
    label: "Classes",
    allowedRoles: ["principal", "directeur_etudes"],
  },
  {
    id: "subjects",
    to: "/subjects",
    label: "Matières",
    allowedRoles: ["principal", "directeur_etudes"],
  },
  {
    id: "coefficients",
    to: "/subjects/coefficients",
    label: "Coefficients",
    allowedRoles: ["principal", "directeur_etudes"],
  },
  {
    id: "assignments",
    to: "/assignments",
    label: "Attributions",
    allowedRoles: ["principal", "directeur_etudes"],
  },
  {
    id: "assignments-overview",
    to: "/assignments/overview",
    label: "Vue d'ensemble",
    allowedRoles: ["principal", "directeur_etudes"],
  },
  {
    id: "users",
    to: "/users",
    label: "Gestion Comptes",
    allowedRoles: ["principal", "directeur_etudes"],
  },
  {
    id: "grades",
    to: "/grades",
    label: "Bulletins & Notes",
    allowedRoles: ["principal", "directeur_etudes"],
  },
  {
    id: "finance",
    to: "/finance",
    label: "Finance & Scolarité",
    allowedRoles: ["principal", "directeur_etudes"],
  },
  {
    id: "settings",
    to: "/settings",
    label: "Paramètres",
    allowedRoles: ["principal", "directeur_etudes"],
  },
];

/**
 * Retourne les éléments de navigation autorisés pour un rôle donné.
 */
export function getNavItemsForRole(role?: string | null): NavItemConfig[] {
  if (!role) return [];
  return NAVIGATION_ITEMS.filter((item) => item.allowedRoles.includes(role));
}

/**
 * Vérifie si un rôle a l'autorisation d'accéder à un chemin (route) donné.
 */
export function isRouteAllowedForRole(pathname: string, role?: string | null): boolean {
  if (!role) return false;
  
  // Chercher la configuration correspondant au pathname exact ou préfixe (pour /students/:id par exemple)
  const item = NAVIGATION_ITEMS.find((nav) => {
    if (nav.to === pathname) return true;
    if (nav.to !== "/" && pathname.startsWith(nav.to + "/")) return true;
    return false;
  });

  // Si la route n'est pas dans le tableau (ex: / ou inconnue), on autorise ou rejette selon la politique
  if (!item) return true; // Les routes non déclarées spécifiques sont gérées par la route * / accueil

  return item.allowedRoles.includes(role);
}
