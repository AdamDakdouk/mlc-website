import { connectToDatabase } from "../src/lib/db";
import { User } from "../src/models/User";
import { hashPassword } from "../src/lib/password";
import { env } from "../src/lib/env";

async function seedAdmin() {
  await connectToDatabase();

  const existing = await User.findOne({ email: env.ADMIN_EMAIL });
  if (existing) {
    console.log(`Admin user ${env.ADMIN_EMAIL} already exists. Skipping.`);
    process.exit(0);
  }

  const passwordHash = await hashPassword(env.ADMIN_PASSWORD);
  await User.create({
    email: env.ADMIN_EMAIL,
    passwordHash,
    role: "admin",
  });

  console.log(`Admin user ${env.ADMIN_EMAIL} created.`);
  process.exit(0);
}

seedAdmin().catch((err) => {
  console.error("Failed to seed admin user:", err);
  process.exit(1);
});
