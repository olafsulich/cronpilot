import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		environment: "node",
		globals: false,
		testTimeout: 15_000,
		// Run integration tests sequentially to avoid DB conflicts
		pool: "forks",
		poolOptions: {
			forks: { singleFork: true },
		},
	},
});
