import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { magicLink } from "better-auth/plugins";
import { getDb } from "@/db/client";
import * as schema from "@/db/schema";
import { sendAuthEmail } from "@/auth/mailer";
import { socialProvidersConfig } from "@/auth/providers";
import { getEnv } from "@/lib/env";

export const auth = betterAuth({
  appName: "Pushoow",
  baseURL: getEnv().BETTER_AUTH_URL ?? getEnv().APP_URL ?? "http://localhost:3000",
  secret: getEnv().BETTER_AUTH_SECRET,
  database: drizzleAdapter(getDb(), {
    provider: "pg",
    schema,
  }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    requireEmailVerification: false,
  },
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    async sendVerificationEmail({ user, url }) {
      await sendAuthEmail({
        to: user.email,
        subject: "Verify your Pushoow email",
        body: `Confirm your email: ${url}`,
      });
    },
  },
  socialProviders: socialProvidersConfig(),
  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 12,
    cookieCache: {
      enabled: true,
      maxAge: 60 * 5,
    },
  },
  trustedOrigins: [getEnv().APP_URL ?? "http://localhost:3000"],
  plugins: [
    magicLink({
      expiresIn: 60 * 10,
      storeToken: "hashed",
      async sendMagicLink({ email, url }) {
        await sendAuthEmail({
          to: email,
          subject: "Your Pushoow sign-in link",
          body: `Use this link to sign in: ${url}`,
        });
      },
    }),
    nextCookies(),
  ],
  databaseHooks: {
    user: {
      create: {
        async after(createdUser) {
          const { onUserCreated } = await import("@/auth/on-user-created");
          await onUserCreated({
            id: createdUser.id,
            email: createdUser.email,
          });
        },
      },
    },
  },
});
