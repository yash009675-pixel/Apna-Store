-- Phase 21: Help Center
create table if not exists public.help_articles(
 id uuid primary key default gen_random_uuid(), audience text not null check(audience in('customer','seller')), category text not null,
 title text not null, body text not null, is_published boolean not null default true, sort_order integer not null default 0,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table public.help_articles enable row level security;
create index if not exists idx_help_articles_audience_category_order on public.help_articles(audience,category,is_published,sort_order);

insert into public.help_articles(audience,category,title,body,is_published,sort_order) values
('customer','Orders','How do I view my orders?','Sign in and open Account to view your order history and order-specific details.',true,10),
('customer','Delivery','Where can I find delivery information?','Open your order from Account to review the available delivery and tracking information.',true,20),
('customer','Payment','How are payments handled?','Choose an available payment method during checkout. Payment status is shown with your order.',true,30),
('customer','Returns','How do I request a return?','Open the relevant order and use the available return flow when the order is eligible.',true,40),
('customer','Refunds','How do refunds work?','Refund status is shown with the relevant return/order. Refunds are not represented as successful until the real payment workflow confirms them.',true,50),
('customer','Account','How do I manage my account?','Sign in to Account to review your profile and order history.',true,60),
('customer','Product','How do I choose a product or variant?','Open the product page and review its available options, price, stock and product information before adding it to your bag.',true,70),
('customer','Other','I still need help.','Use the order/account information available in Apna Store or contact the support channel provided by the platform.',true,80),
('seller','Listings','How do I manage listings?','Use Seller Center to manage your products, listing information, variants and inventory.',true,10),
('seller','Images','How do I add product images?','Use the seller product workflow to upload and manage product images for your listings.',true,20),
('seller','Inventory','How do I manage stock?','Use Seller Center inventory controls and keep variant stock aligned with your actual available inventory.',true,30),
('seller','Orders','Where are seller orders?','Open Seller Center to review orders associated with your seller account.',true,40),
('seller','Pickup','How does pickup work?','Use the seller logistics flow to provide the required pickup information and schedule a real pickup when eligible.',true,50),
('seller','Courier','How do I use courier tools?','Use Seller Center logistics tools. Courier identifiers and tracking data are shown only when returned by the real courier workflow.',true,60),
('seller','Payments','Where are seller payment details?','Review the payment and settlement information available to your seller account.',true,70),
('seller','Returns','How do I handle returns?','Use the seller return-management flow to review and act on return requests.',true,80),
('seller','Ads','How do I create an ad campaign?','Open Advertising Center to create a campaign with budget, dates and product/category/keyword targeting.',true,90),
('seller','Growth','Where can I see growth insights?','Use Seller Center analytics and insights pages for the real data available to your account.',true,100),
('seller','Account','How do I manage my seller account?','Use Seller Center account/profile controls and keep verification information current.',true,110)
on conflict do nothing;
