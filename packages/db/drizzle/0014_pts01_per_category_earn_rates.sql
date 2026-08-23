-- PTS-01: Taxas de acúmulo por categoria e flag de resgate parcial
ALTER TABLE points_settings
  ADD COLUMN earn_rate_copa           integer,
  ADD COLUMN earn_rate_court_rental   integer,
  ADD COLUMN earn_rate_class_package  integer,
  ADD COLUMN allow_partial_redemption boolean NOT NULL DEFAULT true;
