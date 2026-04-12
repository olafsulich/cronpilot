import { Redis } from "ioredis";

const redisUrl = process.env.REDIS_URL ?? "redis://localhost:6379";

export const redis = new Redis(redisUrl, {
	maxRetriesPerRequest: null,
	enableReadyCheck: false,
});

redis.on("error", (err: Error) => {
	console.error("[redis] connection error:", err.message);
});

redis.on("connect", () => {
	console.log("[redis] connected");
});
