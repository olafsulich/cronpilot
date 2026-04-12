import type { BillingResponse } from "@cronpilot/shared";
import { AppError, PLANS } from "@cronpilot/shared";
import Stripe from "stripe";
import { prisma } from "../lib/prisma";

function getStripe(): Stripe {
	const key = process.env.STRIPE_SECRET_KEY;
	if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
	return new Stripe(key, { apiVersion: "2024-06-20" });
}

export async function getBillingInfo(teamId: string): Promise<BillingResponse> {
	const team = await prisma.team.findUniqueOrThrow({
		where: { id: teamId },
		select: {
			id: true,
			plan: true,
			stripeCustomerId: true,
			stripeSubscriptionId: true,
			trialEndsAt: true,
		},
	});

	const plan = PLANS[team.plan as keyof typeof PLANS] ?? PLANS.free;

	return {
		plan: team.plan,
		planLimits: plan,
		stripeCustomerId: team.stripeCustomerId,
		stripeSubscriptionId: team.stripeSubscriptionId,
		trialEndsAt: team.trialEndsAt?.toISOString() ?? null,
	};
}

export async function createCheckoutSession(
	teamId: string,
	userId: string,
	priceId: string,
): Promise<{ url: string }> {
	const stripe = getStripe();
	const appUrl = process.env.APP_URL ?? "http://localhost:3000";

	const team = await prisma.team.findUniqueOrThrow({
		where: { id: teamId },
		select: { id: true, stripeCustomerId: true },
	});

	const user = await prisma.user.findUniqueOrThrow({
		where: { id: userId },
		select: { email: true },
	});

	let customerId = team.stripeCustomerId;
	if (!customerId) {
		const customer = await stripe.customers.create({
			email: user.email,
			metadata: { teamId },
		});
		customerId = customer.id;
		await prisma.team.update({
			where: { id: teamId },
			data: { stripeCustomerId: customerId },
		});
	}

	const session = await stripe.checkout.sessions.create({
		customer: customerId,
		mode: "subscription",
		payment_method_types: ["card"],
		line_items: [{ price: priceId, quantity: 1 }],
		success_url: `${appUrl}/billing?session_id={CHECKOUT_SESSION_ID}&success=true`,
		cancel_url: `${appUrl}/billing?canceled=true`,
		metadata: { teamId },
	});

	if (!session.url) {
		throw new AppError(
			"INTERNAL_ERROR",
			"Failed to create Stripe checkout session",
			500,
		);
	}

	return { url: session.url };
}

export async function createPortalSession(
	teamId: string,
): Promise<{ url: string }> {
	const stripe = getStripe();
	const appUrl = process.env.APP_URL ?? "http://localhost:3000";

	const team = await prisma.team.findUniqueOrThrow({
		where: { id: teamId },
		select: { stripeCustomerId: true },
	});

	if (!team.stripeCustomerId) {
		throw new AppError(
			"BAD_REQUEST",
			"No billing account found. Please subscribe first.",
			400,
		);
	}

	const session = await stripe.billingPortal.sessions.create({
		customer: team.stripeCustomerId,
		return_url: `${appUrl}/billing`,
	});

	return { url: session.url };
}

export async function handleStripeEvent(event: Stripe.Event): Promise<void> {
	switch (event.type) {
		case "checkout.session.completed": {
			const session = event.data.object as Stripe.Checkout.Session;
			const teamId = session.metadata?.teamId;
			const subscriptionId =
				typeof session.subscription === "string"
					? session.subscription
					: session.subscription?.id;

			if (!teamId || !subscriptionId) break;

			// Retrieve subscription to get the product
			const stripe = getStripe();
			const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
				expand: ["items.data.price.product"],
			});

			const plan = extractPlanFromSubscription(subscription);

			await prisma.team.update({
				where: { id: teamId },
				data: {
					plan,
					stripeSubscriptionId: subscriptionId,
				},
			});
			break;
		}

		case "customer.subscription.updated": {
			const subscription = event.data.object as Stripe.Subscription;
			const teamId = subscription.metadata.teamId;
			if (!teamId) break;

			const plan = extractPlanFromSubscription(subscription);
			const status = subscription.status;

			await prisma.team.update({
				where: { stripeSubscriptionId: subscription.id },
				data: {
					plan: status === "active" || status === "trialing" ? plan : "free",
				},
			});
			break;
		}

		case "customer.subscription.deleted": {
			const subscription = event.data.object as Stripe.Subscription;
			await prisma.team.updateMany({
				where: { stripeSubscriptionId: subscription.id },
				data: { plan: "free", stripeSubscriptionId: null },
			});
			break;
		}
	}
}

function extractPlanFromSubscription(
	subscription: Stripe.Subscription,
): string {
	const item = subscription.items.data[0];
	if (!item) return "free";

	const product = item.price.product;
	const productName =
		typeof product === "object" && product !== null && "name" in product
			? (product as Stripe.Product).name.toLowerCase()
			: "";

	if (productName.includes("pro")) return "pro";
	if (productName.includes("business") || productName.includes("team"))
		return "business";
	return "free";
}
