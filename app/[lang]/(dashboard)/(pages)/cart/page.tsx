import { getDictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";
import { CartPage } from "@/components/cart/cart-page";

export default async function CartPageRoute({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const dict = await getDictionary(lang as Locale, "cart");

  return (
    <div className="space-y-6 md:space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-text-primary">
          {dict.pageTitle || "Warenkorb"}
        </h2>
        <p className="text-text-secondary mt-1 text-sm">
          {dict.pageSubtitle ||
            "Deine reservierten Karten. Schließe den Versand innerhalb der Frist ab."}
        </p>
      </div>
      <CartPage lang={lang} dict={dict} />
    </div>
  );
}
