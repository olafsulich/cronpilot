import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("swr");
vi.mock("@/lib/api", () => ({
	apiClient: {
		get: vi.fn(),
		post: vi.fn(),
		delete: vi.fn(),
	},
}));
vi.mock("@/lib/utils", () => ({
	formatDate: vi.fn(() => "Jan 1, 2024"),
}));

import useSWR from "swr";
import { apiClient } from "@/lib/api";
import IntegrationsPage from "../app/(dashboard)/settings/integrations/page";

const mockUseSWR = vi.mocked(useSWR);
const mockPost = vi.mocked(apiClient.post);

// Return a non-empty list so only the header "Add integration" button renders
// (empty state renders a second button with the same label).
const existingIntegration = {
	id: "int-existing",
	type: "slack",
	name: "Slack",
	createdAt: new Date().toISOString(),
};

beforeEach(() => {
	vi.clearAllMocks();
	mockUseSWR.mockReturnValue({
		data: [existingIntegration],
		isLoading: false,
		mutate: vi.fn(),
	} as unknown as ReturnType<typeof useSWR>);
});

function openModal() {
	fireEvent.click(screen.getByRole("button", { name: /add integration/i }));
}

function selectDiscord() {
	fireEvent.click(screen.getByText("Discord"));
}

describe("Discord integration form", () => {
	it("renders Discord as a type option in the modal", () => {
		render(<IntegrationsPage />);
		openModal();
		expect(screen.getByText("Discord")).toBeInTheDocument();
	});

	it("shows the webhook URL field when Discord is selected", () => {
		render(<IntegrationsPage />);
		openModal();
		selectDiscord();
		expect(screen.getByPlaceholderText("https://discord.com/api/webhooks/...")).toBeInTheDocument();
	});

	it("calls apiClient.post with the correct discord payload on submit", async () => {
		mockPost.mockResolvedValue({ data: { id: "int-1", type: "discord", name: "Discord" } });

		render(<IntegrationsPage />);
		openModal();
		selectDiscord();

		fireEvent.change(screen.getByPlaceholderText("My Slack integration"), {
			target: { value: "My Discord" },
		});
		fireEvent.change(screen.getByPlaceholderText("https://discord.com/api/webhooks/..."), {
			target: { value: "https://discord.com/api/webhooks/123456/abcdef" },
		});

		// The header button is still in the DOM behind the modal; the submit button is last
		const submitBtn = screen.getAllByRole("button", { name: /^add integration$/i }).at(-1)!;
		fireEvent.click(submitBtn);

		await waitFor(() => {
			expect(mockPost).toHaveBeenCalledWith(
				"/integrations",
				expect.objectContaining({
					type: "discord",
					webhookUrl: "https://discord.com/api/webhooks/123456/abcdef",
				}),
			);
		});
	});

	it("shows a validation error for a non-Discord webhook URL", async () => {
		render(<IntegrationsPage />);
		openModal();
		selectDiscord();

		fireEvent.change(screen.getByPlaceholderText("My Slack integration"), {
			target: { value: "My Discord" },
		});
		fireEvent.change(screen.getByPlaceholderText("https://discord.com/api/webhooks/..."), {
			target: { value: "https://hooks.slack.com/services/invalid" },
		});

		const submitBtn = screen.getAllByRole("button", { name: /^add integration$/i }).at(-1)!;
		fireEvent.click(submitBtn);

		await waitFor(() => {
			expect(screen.getByText(/discord webhook url/i)).toBeInTheDocument();
		});
		expect(mockPost).not.toHaveBeenCalled();
	});
});
