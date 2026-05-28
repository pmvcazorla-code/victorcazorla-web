export type NavItem = {
  href: string;
  label: string;
};

export const navItems = {
  es: [
    { href: "/", label: "Inicio" },
    { href: "/it", label: "Dirección y Gobernanza de IT" },
    { href: "/cienciasambientales", label: "Gestión Ambiental" },
    { href: "/deontologia", label: "Deontología" },
    { href: "/formacion", label: "Formación" },
  ],
  en: [
    { href: "/en", label: "Home" },
    { href: "/en/it", label: "IT Management & Governance" },
    { href: "/en/cienciasambientales", label: "Environmental Science" },
    { href: "/en/deontologia", label: "Ethics" },
    { href: "/en/formacion", label: "Education" },
  ],
};

export const alternateLabel = {
  es: "English",
  en: "Español",
};
