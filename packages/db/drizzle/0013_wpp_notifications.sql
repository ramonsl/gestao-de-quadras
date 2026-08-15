-- WPP-03: adiciona canal de alteração de consentimento LGPD
ALTER TABLE customer_opt_in_lgpd
  ADD COLUMN IF NOT EXISTS channel varchar(20) DEFAULT NULL;

-- WPP-04: log persistido de mensagens WhatsApp enviadas (tenant-scoped)
CREATE TABLE IF NOT EXISTS whatsapp_message_log (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           uuid        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  customer_id         uuid        NOT NULL,
  comanda_id          uuid,
  to_e164             varchar(20) NOT NULL,
  body_text           text        NOT NULL,
  status              varchar(20) NOT NULL DEFAULT 'queued',
  provider_message_id varchar(255),
  sent_at             timestamp,
  error_description   text,
  created_at          timestamp   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS whatsapp_msg_log_tenant_customer_idx
  ON whatsapp_message_log (tenant_id, customer_id);

CREATE INDEX IF NOT EXISTS whatsapp_msg_log_tenant_status_idx
  ON whatsapp_message_log (tenant_id, status);
