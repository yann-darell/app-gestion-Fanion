export interface NavItemConfig {
  id: string;
  to: string;
  label: string;
  category: string;
  allowedRoles: string[];
}

export interface NavGroup {
  category: string;
  items: NavItemConfig[];
}

export const NAVIGATION_ITEMS: NavItemConfig[] = [
  // --- Structure & Pédagogie ---
  {
    id: "students",
    to: "/students",
    label: "Élèves",
    category: "Structure & Pédagogie",
    allowedRoles: ["principal", "directeur_etudes"],
  },
  {
    id: "classes",
    to: "/classes",
    label: "Classes",
    category: "Structure & Pédagogie",
    allowedRoles: ["principal", "directeur_etudes"],
  },
  {
    id: "subjects",
    to: "/subjects",
    label: "Matières",
    category: "Structure & Pédagogie",
    allowedRoles: ["principal", "directeur_etudes"],
  },
  {
    id: "coefficients",
    to: "/subjects/coefficients",
    label: "Coefficients",
    category: "Structure & Pédagogie",
    allowedRoles: ["principal", "directeur_etudes"],
  },
  {
    id: "assignments",
    to: "/assignments",
    label: "Attributions",
    category: "Structure & Pédagogie",
    allowedRoles: ["principal", "directeur_etudes"],
  },
  {
    id: "assignments-overview",
    to: "/assignments/overview",
    label: "Vue d'ensemble",
    category: "Structure & Pédagogie",
    allowedRoles: ["principal", "directeur_etudes"],
  },

  // --- Évaluations & Examens ---
  {
    id: "bulletins-pdf",
    to: "/bulletins",
    label: "Bulletins PDF",
    category: "Évaluations & Examens",
    allowedRoles: ["principal", "directeur_etudes"],
  },
  {
    id: "grades",
    to: "/grades",
    label: "Saisie Direction",
    category: "Évaluations & Examens",
    allowedRoles: ["principal", "directeur_etudes"],
  },
  {
    id: "reports-class",
    to: "/reports/class",
    label: "Bordereau de classe",
    category: "Évaluations & Examens",
    allowedRoles: ["principal", "directeur_etudes"],
  },

  // --- Finance & Administration ---
  {
    id: "finance",
    to: "/finance",
    label: "Finance & Scolarité",
    category: "Finance & Administration",
    allowedRoles: ["principal", "directeur_etudes"],
  },
  {
    id: "users",
    to: "/users",
    label: "Gestion Comptes",
    category: "Finance & Administration",
    allowedRoles: ["principal", "directeur_etudes"],
  },

  // --- Espace Enseignant ---
  {
    id: "teacher-grades",
    to: "/teacher/grades",
    label: "Saisir mes notes",
    category: "Espace Enseignant",
    allowedRoles: ["enseignant"],
  },
  {
    id: "teacher-evolution",
    to: "/teacher/evolution",
    label: "Évolution élèves",
    category: "Espace Enseignant",
    allowedRoles: ["enseignant"],
  },

  // --- Paramètres ---
  {
    id: "settings",
    to: "/settings",
    label: "Paramètres",
    category: "Finance & Administration",
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
 * Retourne les éléments de navigation autorisés et groupés par catégorie pour un rôle donné.
 */
export function getGroupedNavItemsForRole(role?: string | null): NavGroup[] {
  const allowed = getNavItemsForRole(role);
  const groupsMap = new Map<string, NavItemConfig[]>();

  for (const item of allowed) {
    const cat = item.category;
    if (!groupsMap.has(cat)) {
      groupsMap.set(cat, []);
    }
    groupsMap.get(cat)!.push(item);
  }

  return Array.from(groupsMap.entries()).map(([category, items]) => ({
    category,
    items,
  }));
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
