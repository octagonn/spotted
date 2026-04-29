begin;
select plan(8);

select has_table('public', 'iap_receipts', 'iap receipts table exists');
select has_table('public', 'consumable_grants', 'consumable grants table exists');
select policies_are('public', 'iap_receipts', array['iap_receipts_select_self']);
select policies_are('public', 'consumable_grants', array['consumable_grants_select_self']);
select has_column('public', 'profiles', 'subscription_tier', 'profiles has tier');
select has_column('public', 'posts', 'saved', 'posts has saved flag');
select has_function('public', 'checkin', array['uuid','double precision','double precision','boolean'], 'checkin rpc exists');
select has_function('public', 'checkout', array['uuid'], 'checkout rpc exists');

select * from finish();
rollback;
