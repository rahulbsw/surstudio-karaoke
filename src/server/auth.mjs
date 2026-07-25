import "./env.mjs";
import { ExpressAuth, getSession } from "@auth/express";
import Google from "@auth/express/providers/google";

const clientId = String(process.env.AUTH_GOOGLE_ID || process.env.GOOGLE_CLIENT_ID || "").trim();
const clientSecret = String(process.env.AUTH_GOOGLE_SECRET || process.env.GOOGLE_CLIENT_SECRET || "").trim();
const secret = String(process.env.AUTH_SECRET || "").trim();

export const authConfigured = Boolean(clientId && clientSecret && secret.length >= 32);

export const authConfig = {
  basePath: "/api/auth",
  trustHost: true,
  secret,
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 30 },
  providers: authConfigured
    ? [Google({ clientId, clientSecret })]
    : [],
  callbacks: {
    async signIn({ profile }) {
      return profile?.email_verified !== false;
    },
    async jwt({ token, profile }) {
      if (profile?.sub) token.surStudioUserId = String(profile.sub);
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = String(token.surStudioUserId || token.sub || "");
      }
      return session;
    },
  },
};

export function installAuth(app) {
  if (!authConfigured) {
    app.use("/api/auth", (_request, response) => {
      response.status(503).json({
        error: "Google sign-in is not configured for this SurStudio environment.",
        configured: false,
      });
    });
    return;
  }
  app.use("/api/auth", ExpressAuth(authConfig));
}

export async function getCurrentUser(request) {
  if (!authConfigured) return null;
  const session = await getSession(request, authConfig);
  const user = session?.user;
  if (!user?.id || !user.email) return null;
  return {
    id: String(user.id),
    email: String(user.email),
    name: user.name ? String(user.name) : null,
    image: user.image ? String(user.image) : null,
  };
}
