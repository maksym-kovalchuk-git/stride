alter table products
  add column gender text check (gender in ('male', 'female', 'kids'));