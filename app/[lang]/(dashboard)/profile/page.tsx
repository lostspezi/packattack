import { auth } from "@/lib/auth";
import { getDictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";
import { Card } from "@/components/ui/card";
import { ProfileForm } from "@/components/profile/profile-form";
import connectDB from "@/lib/db";
import User from "@/models/user";
import { MongoClient, ObjectId } from "mongodb";

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;

  const session = await auth();

  const [profileDict] = await Promise.all([
    getDictionary(lang as Locale, "profile"),
  ]);

  await connectDB();

  const userId = session!.user!.id;

  // Fetch user data and linked providers in parallel
  const nativeClient = new MongoClient(process.env.MONGODB_URI!);
  await nativeClient.connect();
  const db = nativeClient.db();

  const [user, accounts] = await Promise.all([
    User.findById(userId).lean(),
    db
      .collection("accounts")
      .find({ userId: new ObjectId(userId) })
      .toArray(),
  ]);

  await nativeClient.close();

  const linkedProviders = accounts.map((a) => a.provider as string);

  const initialData = {
    name: user?.name ?? "",
    username: user?.username ?? "",
    bio: user?.bio ?? null,
    socialLinks: user?.socialLinks ?? {},
    publicProfile: user?.publicProfile ?? false,
    role: user?.role ?? "user",
    image: user?.image ?? null,
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-text-primary">
          {profileDict["pageTitle"] ?? "Profile"}
        </h2>
        <p className="text-text-secondary mt-1 text-sm">
          {profileDict["pageSubtitle"] ?? "Manage your public profile information."}
        </p>
      </div>

      <Card variant="soft" className="p-6">
        <ProfileForm
          dict={profileDict}
          lang={lang}
          initialData={initialData}
          linkedProviders={linkedProviders}
        />
      </Card>
    </div>
  );
}
