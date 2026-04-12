"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Activity, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

const loginSchema = z.object({
	email: z.string().email("Please enter a valid email address"),
	password: z.string().min(8, "Password must be at least 8 characters"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const callbackUrl = searchParams.get("callbackUrl") ?? "/dashboard/monitors";
	const [serverError, setServerError] = useState<string | null>(null);

	const {
		register,
		handleSubmit,
		formState: { errors, isSubmitting },
	} = useForm<LoginFormValues>({
		resolver: zodResolver(loginSchema),
	});

	async function onSubmit(values: LoginFormValues) {
		setServerError(null);
		const result = await signIn("credentials", {
			email: values.email,
			password: values.password,
			redirect: false,
			callbackUrl,
		});

		if (result?.error) {
			setServerError("Invalid email or password. Please try again.");
			return;
		}

		router.push(callbackUrl);
		router.refresh();
	}

	return (
		<div className="min-h-screen bg-[#FFF9F5] flex items-center justify-center px-4">
			<div className="w-full max-w-md">
				{/* Logo */}
				<div className="flex justify-center mb-8">
					<Link href="/" className="flex items-center gap-2 text-orange-500">
						<Activity className="h-7 w-7" />
						<span className="text-xl font-semibold text-gray-900">
							Cronpilot
						</span>
					</Link>
				</div>

				<div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
					<h1 className="text-2xl font-bold text-gray-900 mb-1">
						Welcome back
					</h1>
					<p className="text-gray-500 text-sm mb-8">Sign in to your account</p>

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
							<div className="flex items-center justify-between mb-1.5">
								<label
									htmlFor="password"
									className="block text-sm font-medium text-gray-700"
								>
									Password
								</label>
								<Link
									href="/forgot-password"
									className="text-xs text-orange-500 hover:text-orange-600 transition-colors"
								>
									Forgot password?
								</Link>
							</div>
							<input
								id="password"
								type="password"
								autoComplete="current-password"
								{...register("password")}
								className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent transition"
								placeholder="••••••••"
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
							{isSubmitting ? "Signing in…" : "Sign in"}
						</button>
					</form>
				</div>

				<p className="text-center text-sm text-gray-500 mt-6">
					Don&apos;t have an account?{" "}
					<Link
						href="/signup"
						className="text-orange-500 hover:text-orange-600 font-medium transition-colors"
					>
						Create one free
					</Link>
				</p>
			</div>
		</div>
	);
}
