import { AppError } from "@cronpilot/shared";
import type {
	GetServerSidePropsContext,
	NextApiRequest,
	NextApiResponse,
} from "next";
import { redirect } from "next/navigation";
import {
	type NextAuthOptions,
	getServerSession as nextAuthGetServerSession,
	type Session,
} from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

interface AuthUser {
	id: string;
	email: string;
	teamId: string;
	accessToken: string;
}

declare module "next-auth" {
	interface Session {
		user: {
			id: string;
			email: string;
		};
		teamId: string;
		accessToken: string;
	}

	interface User extends AuthUser {}
}

declare module "next-auth/jwt" {
	interface JWT {
		userId: string;
		email: string;
		teamId: string;
		accessToken: string;
	}
}

function getApiUrl(): string {
	const url = process.env.API_INTERNAL_URL;
	if (!url) throw new Error("API_INTERNAL_URL is not set");
	return url;
}

export const authOptions: NextAuthOptions = {
	session: {
		strategy: "jwt",
		maxAge: 30 * 24 * 60 * 60, // 30 days
	},

	pages: {
		signIn: "/login",
		error: "/login",
	},

	providers: [
		CredentialsProvider({
			name: "Credentials",
			credentials: {
				email: { label: "Email", type: "email" },
				password: { label: "Password", type: "password" },
			},
			async authorize(credentials) {
				if (!credentials?.email || !credentials.password) {
					throw new AppError(
						"INVALID_CREDENTIALS",
						"Email and password are required",
						400,
					);
				}

				const res = await fetch(`${getApiUrl()}/auth/login`, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						email: credentials.email,
						password: credentials.password,
					}),
				});

				if (!res.ok) {
					const body = (await res.json().catch(() => ({}))) as {
						error?: { message?: string };
					};
					throw new AppError(
						"INVALID_CREDENTIALS",
						body.error?.message ?? "Invalid email or password",
						401,
					);
				}

				const body = (await res.json()) as {
					data: {
						accessToken: string;
						user: { id: string; email: string };
						teamId: string;
					};
				};

				return {
					id: body.data.user.id,
					email: body.data.user.email,
					teamId: body.data.teamId,
					accessToken: body.data.accessToken,
				};
			},
		}),
	],

	callbacks: {
		async jwt({ token, user }) {
			// On initial sign-in, user is populated
			if (user) {
				token.userId = user.id;
				token.email = user.email ?? "";
				token.teamId = user.teamId;
				token.accessToken = user.accessToken;
			}
			return token;
		},

		async session({ session, token }) {
			session.user = {
				id: token.userId,
				email: token.email,
			};
			session.teamId = token.teamId;
			session.accessToken = token.accessToken;
			return session;
		},
	},
};

type SessionContext =
	| {
			req: GetServerSidePropsContext["req"];
			res: GetServerSidePropsContext["res"];
	  }
	| { req: NextApiRequest; res: NextApiResponse };

export async function getServerSession(
	ctx?: SessionContext,
): Promise<Session | null> {
	if (ctx) {
		return nextAuthGetServerSession(ctx.req, ctx.res, authOptions);
	}
	return nextAuthGetServerSession(authOptions);
}

/**
 * Call in Server Components to redirect unauthenticated users.
 * Returns the session if authenticated.
 */
export async function requireSession(): Promise<Session> {
	const session = await getServerSession();
	if (!session) {
		redirect("/login");
	}
	return session;
}
