export type NavItem = {
  key: string;
  label: string;
  href: string;
  icon: string;
  adminOnly?: boolean;
  /** Show a "Soon" badge. If true, non-admins cannot click the link. */
  soon?: boolean;
};

export const mainNavItems: NavItem[] = [
  { key: "dashboard", label: "Dashboard", href: "/dashboard", icon: "LayoutGrid" },
  { key: "packs", label: "Packs", href: "/packs", icon: "Package" },
  { key: "battles", label: "Battles", href: "/battles", icon: "Swords" },
  { key: "leaderboard", label: "Bestenliste", href: "/leaderboard", icon: "Trophy" },
  { key: "events", label: "Events", href: "/events", icon: "Zap" },

  { key: "cart", label: "Warenkorb", href: "/cart", icon: "ShoppingCart" },
  { key: "orders", label: "Bestellungen", href: "/orders", icon: "Package" },
  { key: "feedback", label: "Feedback", href: "/feedback", icon: "MessageSquareMore" },
  { key: "profile", label: "Profil", href: "/profile", icon: "User" },
  { key: "settings", label: "Einstellungen", href: "/settings", icon: "Settings" },
  { key: "account", label: "Konto", href: "/account", icon: "Shield" },
  { key: "balance", label: "Guthaben", href: "/balance", icon: "Wallet" },
];

export const adminNavItems: NavItem[] = [
  { key: "dashboard", label: "Dashboard", href: "/admin", icon: "BarChart3" },
  { key: "users", label: "Benutzer", href: "/admin/users", icon: "Users" },
  { key: "platform", label: "Plattform", href: "/admin/platform", icon: "Cog" },
  { key: "notifications", label: "Benachrichtigungen", href: "/admin/notifications", icon: "Bell" },
  { key: "chat", label: "Chat", href: "/admin/chat", icon: "MessagesSquare" },
  { key: "feedback", label: "Feedback", href: "/admin/feedback", icon: "MessageSquareMore" },
  { key: "emailTemplates", label: "E-Mail-Vorlagen", href: "/admin/email-templates", icon: "Mail" },
  { key: "translations", label: "Übersetzungen", href: "/admin/translations", icon: "Languages" },
  { key: "languages", label: "Sprachen", href: "/admin/languages", icon: "Globe" },
  { key: "boxes", label: "Boxen", href: "/admin/boxes", icon: "Package" },
  { key: "coins", label: "Coins", href: "/admin/coins", icon: "Coins" },
  { key: "shops", label: "Shops", href: "/admin/shops", icon: "Store" },
  { key: "adminInventory", label: "Inventar", href: "/admin/inventory", icon: "Layers" },
  { key: "inventoryOverview", label: "Inventar-Übersicht", href: "/admin/inventory/overview", icon: "Eye" },
  { key: "coinPackages", label: "Coin-Pakete", href: "/admin/coin-packages", icon: "CreditCard" },
  { key: "adminOrders", label: "Bestellungen", href: "/admin/orders", icon: "ClipboardList" },
  { key: "adminShipping", label: "Versand", href: "/admin/shipping", icon: "Truck" },
  { key: "adminSeasons", label: "Battle Seasons", href: "/admin/seasons", icon: "Trophy" },
  { key: "adminAchievements", label: "Achievements", href: "/admin/achievements", icon: "Award" },
  { key: "adminQuizEvents", label: "Quiz Events", href: "/admin/quiz-events", icon: "Zap" },
  { key: "adminPacki", label: "Packi", href: "/admin/packi", icon: "Sparkles" },
  { key: "adminFairness", label: "Fairness", href: "/admin/fairness", icon: "ShieldCheck" },
  { key: "adminNews", label: "News", href: "/admin/news", icon: "Newspaper" },
];

export const shopNavItems: NavItem[] = [
  { key: "shopInventory", label: "Inventar", href: "/shop/inventory", icon: "Layers" },
  { key: "shopFulfillments", label: "Versandaufträge", href: "/shop/fulfillments", icon: "Truck" },
];


export const soonNavItems: NavItem[] = [
  { key: "marketplace", label: "Marktplatz", href: "#", icon: "ShoppingBag", soon: true },
];
