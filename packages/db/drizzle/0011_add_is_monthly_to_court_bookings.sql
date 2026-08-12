-- CAD-09 / PDV-05: Campo is_monthly em court_bookings
ALTER TABLE "court_bookings"
  ADD COLUMN IF NOT EXISTS "is_monthly" boolean DEFAULT false NOT NULL;
