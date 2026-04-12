"use client";

import { RegisterSchema } from "@cronpilot/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { Activity, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import { apiClient } from "@/lib/api";

type SignupFormValues = z.infer<typeof RegisterSchema>;

export default function SignupPage() {
	const router = useRouter();
	const [serverError, setServerError] = useState<string | null>(null);

	const {
		register,
		handleSubmit,
		formState: { errors, isSubmitting },
	} = useForm<SignupFormValues>({
		resolver: zodResolver(RegisterSchema),
	});

	async function onSubmit(values: SignupFormValues) {
		setServerError(null);

		try {
			await apiClient.post("/auth/register", values);
		} catch (err: unknown) {
			const error = err as { message?: string; code?: string };
			if (error.code === "DUPLICATE_EMAIL") {
				setServerError(
					"An account with this email already exists. Try signing in.",
				);
			} else {
				setServerError(
					error.message ?? "Something went wrong. Please try again.",
				);
			}
			return;
		}

		// Auto sign-in after registration
		const result = await signIn("credentials", {
			email: values.email,
			password: values.password,
			redirect: false,
			callbackUrl: "/dashboard/monitors",
		});

		if (result?.error) {
			// Registration succeeded but sign-in failed — redirect to login
			router.push("/login?registered=true");
			return;
		}

		router.push("/dashboard/monitors");
		router.refresh();
	}

	return (
		<div className="min-h-screen bg-[#FFF9F5] flex items-center justify-center px-4">
			<div className="w-full max-w-md">
				{/* Logo */}
				<div className="flex justify-center mb-8">
					<Link href="/" className="flex items-center gap-2">
						<Activity className="h-7 w-7 text-orange-500" />
						<span className="text-xl font-semibold text-gray-900">
							Cronpilot
						</span>
					</Link>
				</div>

				<div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
					<h1 className="text-2xl font-bold text-gray-900 mb-1">
						Create your account
					</h1>
					<p className="text-gray-500 text-sm mb-8">
						Get started free. No credit card required.
					</p>

					{serverError && (
						<div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg mb-6">
							{serverError}
						</div>
					)}

					<form
						onSubmit={handleSubmit(onSubmit)}
						noValidate
						className="space-y-5"
					>
						<div>
							<label
								htmlFor="teamName"
								className="block text-sm font-medium text-gray-700 mb-1.5"
							>
								Team name
							</label>
							<input
								id="teamName"
								type="text"
								autoComplete="organization"
								{...register("teamName")}
								className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent transition"
								placeholder="Acme Corp"
							/>
							{errors.teamName && (
								<p className="text-red-600 text-xs mt-1.5">
									{errors.teamName.message}
								</p>
							)}
						</div>

						<div>
							<label
								htmlFor="email"
								className="block text-sm font-medium text-gray-700 mb-1.5"
							>
								Email address
							</label>
							<input
								id="email"
								type="email"
								autoComplete="email"
								{...register("email")}
								className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent transition"
								placeholder="you@example.com"
							/>
							{errors.email && (
								<p className="text-red-600 text-xs mt-1.5">
									{errors.email.message}
								</p>
							)}
						</div>

						<div>
							<label
								htmlFor="password"
								className="block text-sm font-medium text-gray-700 mb-1.5"
							>
								Password
							</label>
							<input
								id="password"
								type="password"
								autoComplete="new-password"
								{...register("password")}
								className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent transition"
								placeholder="At least 8 characters"
							/>
							{errors.password && (
								<p className="text-red-600 text-xs mt-1.5">
									{errors.password.message}
								</p>
							)}
						</div>

						<button
							type="submit"
							disabled={isSubmitting}
							className="w-full flex items-center justify-center gap-2 bg-orange-500 text-white py-2.5 px-4 rounded-lg font-medium text-sm hover:bg-orange-600 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
						>
							{isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
							{isSubmitting ? "Creating account…" : "Create account"}
						</button>
					</form>

					<p className="text-xs text-gray-400 text-center mt-6">
						By creating an account you agree to our{" "}
						<Link href="/terms" className="underline hover:text-gray-600">
							Terms
						</Link>{" "}
						and{" "}
						<Link href="/privacy" className="underline hover:text-gray-600">
							Privacy Policy
						</Link>
						.
					</p>
				</div>

				<p className="text-center text-sm text-gray-500 mt-6">
					Already have an account?{" "}
					<Link
						href="/login"
						className="text-orange-500 hover:text-orange-600 font-medium transition-colors"
					>
						Sign in
					</Link>
				</p>
			</div>
		</div>
	);
}
