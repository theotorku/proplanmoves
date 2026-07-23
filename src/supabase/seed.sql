insert into roles(code, name) values
  ('owner', 'Owner'),
  ('admin', 'Admin'),
  ('estimator', 'Estimator'),
  ('dispatcher', 'Dispatcher'),
  ('viewer', 'Viewer')
on conflict (code) do update set name = excluded.name;

insert into pricing_rules(name, is_active)
values ('ProPlan local moving baseline', true)
on conflict do nothing;

insert into pricing_rule_versions(pricing_rule_id, version_number, rules_json)
select
  pr.id,
  1,
  '{
    "hourlyRatesByCrewSize": { "2": 15900, "3": 21900, "4": 27900 },
    "minimumBillableMinutes": 180,
    "baseMinutesByBedroomCount": { "0": 120, "1": 180, "2": 240, "3": 360, "4": 480, "5": 600 },
    "truckFeeCents": 7500,
    "travelBaseFeeCents": 4500,
    "stairAdjustmentMinutesPerFloor": 30,
    "packingLaborRateCents": 6500,
    "boxAllowanceCents": 350,
    "specialtyItemSurcharges": { "piano": 25000, "safe": 30000, "pool_table": 35000 },
    "weekendAdjustmentCents": 12500,
    "fuelSurchargeCents": 3500,
    "uncertaintyMarginPercent": 15
  }'::jsonb
from pricing_rules pr
where pr.name = 'ProPlan local moving baseline'
on conflict (pricing_rule_id, version_number) do nothing;
