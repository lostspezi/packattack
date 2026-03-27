export type NavItem = {
  key: string;
  href: string;
  icon: string;
  adminOnly?: boolean;
  soon?: boolean;
};

export const mainNavItems: NavItem[] = [
  { key: "dashboard", href: "/dashboard", icon: "LayoutGrid" },
  { key: "packs", href: "/packs", icon: "Package" },
  { key: "claimed", href: "/claimed", icon: "Layers" },
  { key: "profile", href: "/profile", icon: "User" },
  { key: "settings", href: "/settings", icon: "Settings" },
  { key: "account", href: "/account", icon: "Shield" },
];

export const adminNavItems: NavItem[] = [
  { key: "dashboard", href: "/admin", icon: "BarChart3" },
  { key: "users", href: "/admin/users", icon: "Users" },
  { key: "platform", href: "/admin/platform", icon: "Cog" },
  { key: "notifications", href: "/admin/notifications", icon: "Bell" },
  { key: "emailTemplates", href: "/admin/email-templates", icon: "Mail" },
  { key: "translations", href: "/admin/translations", icon: "Languages" },
  { key: "languages", href: "/admin/languages", icon: "Globe" },
  { key: "boxes", href: "/admin/boxes", icon: "Package" },
  { key: "coins", href: "/admin/coins", icon: "Coins" },
  { key: "shops", href: "/admin/shops", icon: "Store" },
  { key: "adminInventory", href: "/admin/inventory", icon: "Layers" },
  { key: "inventoryOverview", href: "/admin/inventory/overview", icon: "Eye" },
];

export const shopNavItems: NavItem[] = [
  { key: "shopInventory", href: "/shop/inventory", icon: "Layers" },
];

export const soonNavItems: NavItem[] = [
  { key: "marketplace", href: "#", icon: "ShoppingBag", soon: true },
];
