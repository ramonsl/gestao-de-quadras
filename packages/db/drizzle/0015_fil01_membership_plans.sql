CREATE TABLE IF NOT EXISTS membership_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name varchar(120) NOT NULL,
  description text NOT NULL,
  cycle_price_cents integer NOT NULL,
  billing_period varchar(20) NOT NULL,
  product_discount_percent integer NOT NULL DEFAULT 0,
  court_rental_discount_percent integer NOT NULL DEFAULT 0,
  class_package_discount_percent integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT membership_plans_price_positive CHECK (cycle_price_cents > 0),
  CONSTRAINT membership_plans_billing_period_valid CHECK (billing_period IN ('monthly', 'semiannual', 'annual')),
  CONSTRAINT membership_plans_discounts_valid CHECK (
    product_discount_percent BETWEEN 0 AND 100
    AND court_rental_discount_percent BETWEEN 0 AND 100
    AND class_package_discount_percent BETWEEN 0 AND 100
  )
);

CREATE INDEX IF NOT EXISTS membership_plans_tenant_name_idx
  ON membership_plans (tenant_id, name);

CREATE TABLE IF NOT EXISTS membership_plan_product_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  membership_plan_id uuid NOT NULL REFERENCES membership_plans(id) ON DELETE CASCADE,
  category varchar(100) NOT NULL,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS membership_plan_categories_unique
  ON membership_plan_product_categories (tenant_id, membership_plan_id, category);

CREATE TABLE IF NOT EXISTS customer_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL,
  membership_plan_id uuid NOT NULL REFERENCES membership_plans(id),
  starts_on date NOT NULL,
  ends_on date,
  status varchar(20) NOT NULL DEFAULT 'active',
  ended_at timestamp,
  ended_by_user_id uuid,
  created_by_user_id uuid NOT NULL,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT customer_memberships_dates_valid CHECK (ends_on IS NULL OR ends_on >= starts_on),
  CONSTRAINT customer_memberships_status_valid CHECK (status IN ('active', 'ended'))
);

CREATE UNIQUE INDEX IF NOT EXISTS customer_memberships_one_active_idx
  ON customer_memberships (tenant_id, customer_id) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS customer_memberships_plan_idx
  ON customer_memberships (tenant_id, membership_plan_id);

ALTER TABLE comandas
  ADD COLUMN IF NOT EXISTS gross_total_cents integer,
  ADD COLUMN IF NOT EXISTS membership_discount_cents integer,
  ADD COLUMN IF NOT EXISTS net_total_cents integer,
  ADD COLUMN IF NOT EXISTS applied_membership_plan_id uuid,
  ADD COLUMN IF NOT EXISTS applied_membership_plan_name varchar(120);

ALTER TABLE comanda_items
  ADD COLUMN IF NOT EXISTS category_at_sale varchar(100),
  ADD COLUMN IF NOT EXISTS membership_discount_percent integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS membership_discount_cents integer NOT NULL DEFAULT 0;

ALTER TABLE comanda_payments ADD COLUMN IF NOT EXISTS settlement_id uuid;
ALTER TABLE student_class_balance ADD COLUMN IF NOT EXISTS settlement_id uuid;

UPDATE comanda_items ci
SET category_at_sale = p.category
FROM products p
WHERE ci.item_type = 'product'
  AND ci.product_id = p.id
  AND ci.tenant_id = p.tenant_id
  AND ci.category_at_sale IS NULL;

CREATE TABLE IF NOT EXISTS comanda_settlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  comanda_id uuid NOT NULL,
  version integer NOT NULL,
  status varchar(20) NOT NULL DEFAULT 'active',
  settlement_token varchar(64) NOT NULL,
  membership_plan_id uuid,
  membership_plan_name varchar(120),
  gross_total_cents integer NOT NULL,
  discount_total_cents integer NOT NULL,
  net_total_cents integer NOT NULL,
  closed_by_user_id uuid NOT NULL,
  closed_at timestamp NOT NULL DEFAULT now(),
  reversed_by_user_id uuid,
  reversed_at timestamp,
  CONSTRAINT comanda_settlements_status_valid CHECK (status IN ('pending', 'active', 'reversed'))
);

CREATE UNIQUE INDEX IF NOT EXISTS comanda_settlements_version_unique
  ON comanda_settlements (tenant_id, comanda_id, version);
CREATE UNIQUE INDEX IF NOT EXISTS comanda_settlements_one_active_idx
  ON comanda_settlements (tenant_id, comanda_id) WHERE status = 'active';

ALTER TABLE comanda_payments
  ADD CONSTRAINT comanda_payments_settlement_fk
  FOREIGN KEY (settlement_id) REFERENCES comanda_settlements(id);
ALTER TABLE student_class_balance
  ADD CONSTRAINT student_class_balance_settlement_fk
  FOREIGN KEY (settlement_id) REFERENCES comanda_settlements(id);
CREATE INDEX IF NOT EXISTS comanda_payments_settlement_idx
  ON comanda_payments (tenant_id, settlement_id);
CREATE INDEX IF NOT EXISTS student_class_balance_settlement_idx
  ON student_class_balance (tenant_id, settlement_id);

-- Protocolo de concorrência do settlement: toda mutação de item bloqueia a
-- linha-pai da comanda. O fechamento toma o mesmo lock antes de recalcular a
-- prévia, impedindo alterações entre o token confirmado e o commit.
CREATE OR REPLACE FUNCTION lock_open_comanda_for_item_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  target_comanda_id uuid;
  target_tenant_id uuid;
  current_status varchar(20);
BEGIN
  IF TG_OP = 'DELETE' THEN
    target_comanda_id := OLD.comanda_id;
    target_tenant_id := OLD.tenant_id;
  ELSE
    target_comanda_id := NEW.comanda_id;
    target_tenant_id := NEW.tenant_id;
  END IF;
  SELECT status INTO current_status
    FROM comandas
    WHERE id = target_comanda_id AND tenant_id = target_tenant_id
    FOR UPDATE;
  IF current_status IS DISTINCT FROM 'open' THEN
    RAISE EXCEPTION 'comanda não está aberta para alteração de itens' USING ERRCODE = 'P0001';
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS comanda_items_lock_parent ON comanda_items;
CREATE TRIGGER comanda_items_lock_parent
BEFORE INSERT OR UPDATE OR DELETE ON comanda_items
FOR EACH ROW EXECUTE FUNCTION lock_open_comanda_for_item_mutation();
