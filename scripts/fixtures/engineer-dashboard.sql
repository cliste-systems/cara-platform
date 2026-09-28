-- Disposable CI database only. Never run against a customer project.
create role metrics_reader nologin;
create table call_logs (
  id text primary key, organization_id text not null, caller_number text not null,
  room_name text, call_sid text, engineer_test_call boolean not null default false,
  is_test_call boolean not null default false, created_at timestamptz not null default '2026-09-28T10:00:00Z',
  outcome text not null default 'answered', duration_seconds integer not null default 30
);
create table action_tickets (
  id text primary key, organization_id text not null, caller_number text not null,
  engineer_test_call boolean not null default false, call_log_id text references call_logs(id)
);
create table cara_training_items (
  id text primary key, organization_id text not null,
  call_log_id text references call_logs(id), action_ticket_id text references action_tickets(id)
);
create table cara_knowledge_events (
  id text primary key, organization_id text not null,
  call_log_id text references call_logs(id), training_item_id text references cara_training_items(id)
);
create table cara_knowledge_temporal_updates (
  id text primary key, organization_id text not null, training_item_id text references cara_training_items(id)
);
create table usage_records (
  id text primary key, organization_id text not null, caller_number text, room_name text,
  call_sid text, sync_skip_reason text, minutes_billable numeric not null default 100
);
insert into call_logs(id,organization_id,caller_number,duration_seconds) values
  ('c1','mixed','+353871234567',30),('c2','mixed','+353872222222',90),('foreign','other','+353879999999',500);
insert into call_logs(id,organization_id,caller_number,engineer_test_call) values ('e-flag','mixed','+353873333333',true);
insert into call_logs(id,organization_id,caller_number) values ('e-number','mixed','+353870000001');
insert into call_logs(id,organization_id,caller_number,room_name) values ('e-room','mixed','+353874444444','admin-demo-fixture');
insert into call_logs(id,organization_id,caller_number,is_test_call) values ('qa','mixed','+353875555555',true);
insert into call_logs(id,organization_id,caller_number,engineer_test_call)
  select 'only-'||n,'engineer-only','+353870000001',true from generate_series(1,6) n;
insert into action_tickets values
  ('t-customer','mixed','+353871234567',false,'c1'),
  ('t-engineer','mixed','+353873333333',true,'e-flag'),
  ('t-linked','mixed','+353874444444',false,'e-room');
insert into cara_training_items values
  ('manual','mixed',null,null),('customer','mixed','c1','t-customer'),
  ('test-call','mixed','e-flag',null),('test-ticket','mixed',null,'t-engineer'),
  ('test-linked','mixed',null,'t-linked'),('qa-training','mixed','qa',null),
  ('foreign-training','other','foreign',null);
insert into cara_knowledge_events values
  ('manual-event','mixed',null,null),('customer-event','mixed','c1','customer'),
  ('test-direct-event','mixed','e-room',null),('test-training-event','mixed',null,'test-call'),
  ('test-ticket-event','mixed',null,'test-ticket'),('test-linked-event','mixed',null,'test-linked'),
  ('qa-event','mixed',null,'qa-training'),('foreign-event','other','foreign','foreign-training');
insert into cara_knowledge_temporal_updates values
  ('manual-temporary','mixed',null),('customer-temporary','mixed','customer'),
  ('test-temporary','mixed','test-call'),('ticket-temporary','mixed','test-ticket'),
  ('linked-temporary','mixed','test-linked'),('qa-temporary','mixed','qa-training');
insert into usage_records(id,organization_id,minutes_billable) values ('u1','mixed',0.5),('u2','mixed',1.5),('foreign-usage','other',999);
insert into usage_records(id,organization_id,sync_skip_reason) values
  ('u-engineer','mixed','engineer_test_call'),('u-test','mixed','test_call'),('u-data','mixed','test_data');
insert into usage_records(id,organization_id,caller_number) values ('u-number','mixed','+353870000001');
insert into usage_records(id,organization_id,room_name) values ('u-room','mixed','admin-demo-fixture'),('u-rehearsal','mixed','text-rehearsal-fixture');
insert into usage_records(id,organization_id,call_sid) values ('u-sid','mixed','RT-TEST-1');
grant usage on schema public to metrics_reader;
grant select on all tables in schema public to metrics_reader;
do $$ declare t text; begin
  foreach t in array array['call_logs','action_tickets','cara_training_items','cara_knowledge_events','cara_knowledge_temporal_updates','usage_records'] loop
    execute format('alter table %I enable row level security',t);
    execute format('create policy tenant_scope on %I for select to metrics_reader using (organization_id = (current_setting(''request.headers'',true)::jsonb ->> ''x-metrics-tenant''))',t);
  end loop;
end $$;
