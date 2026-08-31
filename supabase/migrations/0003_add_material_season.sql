alter table products
  add column material text,
  add column season text check (season in ('spring_summer', 'demi_season', 'winter', 'all_season'));