import "dotenv/config";
import { defineConfig } from "drizzle-kit";

const drizzleOut = process.env.DRIZZLE_OUT;
const drizzleSchema = process.env.DRIZZLE_SCHEMA;

// For Durable Objects
export default defineConfig({
	out: drizzleOut,
	schema: drizzleSchema,
	dialect: "sqlite",
	driver: "durable-sqlite",
});
