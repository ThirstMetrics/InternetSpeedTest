import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';
import { getDb } from '@/lib/db';

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  session: { strategy: 'jwt' },
  callbacks: {
    async signIn({ user }) {
      const sql = getDb();
      if (!sql) return true;

      // Upsert user record in Neon
      await sql`
        INSERT INTO users (email, name, image)
        VALUES (${user.email}, ${user.name}, ${user.image})
        ON CONFLICT (email) DO UPDATE
        SET name = EXCLUDED.name, image = EXCLUDED.image, updated_at = now()
      `;
      return true;
    },
    async jwt({ token }) {
      if (token.email) {
        const sql = getDb();
        if (sql) {
          const rows = await sql`
            SELECT id FROM users WHERE email = ${token.email}
          `;
          if (rows.length > 0) {
            token.userId = rows[0].id;
          }
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (token.userId) {
        session.user.id = token.userId as string;
      }
      return session;
    },
  },
});
