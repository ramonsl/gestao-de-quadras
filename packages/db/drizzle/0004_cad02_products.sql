-- CAD-02: Produtos da Copa e Estoque

CREATE TABLE IF NOT EXISTS "tenant_template"."products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"barcode" varchar(100),
	"sale_price_cents" integer NOT NULL,
	"category" varchar(100) NOT NULL,
	"current_stock" integer DEFAULT 0 NOT NULL,
	"min_stock" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tenant_template"."stock_movements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"quantity_change" integer NOT NULL,
	"reason" varchar(50) NOT NULL,
	"user_id" uuid,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "tenant_template"."stock_movements" ADD CONSTRAINT "stock_movements_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "tenant_template"."products"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "products_barcode_idx" ON "tenant_template"."products" ("barcode");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "products_category_idx" ON "tenant_template"."products" ("category");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "stock_movements_product_id_idx" ON "tenant_template"."stock_movements" ("product_id");
