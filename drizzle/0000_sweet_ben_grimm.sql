CREATE TYPE "public"."pool_status" AS ENUM('active', 'depleted', 'closed');--> statement-breakpoint
CREATE TYPE "public"."donation_status" AS ENUM('pending', 'matched', 'failed');--> statement-breakpoint
CREATE TABLE "auth_nonces" (
	"nonce" text PRIMARY KEY NOT NULL,
	"public_key" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"public_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "match_pools" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sponsor_public_key" text NOT NULL,
	"sponsor_name" text NOT NULL,
	"cause_name" text NOT NULL,
	"cause_description" text NOT NULL,
	"total_funded_minor" text DEFAULT '0' NOT NULL,
	"remaining_minor" text DEFAULT '0' NOT NULL,
	"matched_minor" text DEFAULT '0' NOT NULL,
	"status" "pool_status" DEFAULT 'active' NOT NULL,
	"horizon_tx_hash" text,
	"version" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "donations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pool_id" uuid NOT NULL,
	"donor_public_key" text NOT NULL,
	"donor_name" text NOT NULL,
	"donor_muxed_id" text,
	"amount_minor" text NOT NULL,
	"matched_amount_minor" text DEFAULT '0' NOT NULL,
	"total_impact_minor" text DEFAULT '0' NOT NULL,
	"status" "donation_status" DEFAULT 'pending' NOT NULL,
	"horizon_tx_hash" text,
	"match_tx_hash" text,
	"memo" text,
	"version" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "donations" ADD CONSTRAINT "donations_pool_id_match_pools_id_fk" FOREIGN KEY ("pool_id") REFERENCES "public"."match_pools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "match_pools_status_idx" ON "match_pools" USING btree ("status");--> statement-breakpoint
CREATE INDEX "match_pools_sponsor_idx" ON "match_pools" USING btree ("sponsor_public_key");--> statement-breakpoint
CREATE INDEX "donations_pool_idx" ON "donations" USING btree ("pool_id");--> statement-breakpoint
CREATE INDEX "donations_donor_idx" ON "donations" USING btree ("donor_public_key");--> statement-breakpoint
CREATE INDEX "donations_status_idx" ON "donations" USING btree ("status");--> statement-breakpoint
CREATE INDEX "donations_created_at_idx" ON "donations" USING btree ("created_at");