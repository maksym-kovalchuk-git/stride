alter table addresses
  drop column street,
  drop column postal_code,
  drop column city;
  add column phone text,
  add column np_city_name text,
  add column np_city_ref text,
  add column np_branch_name text,
  add column np_branch_ref text;