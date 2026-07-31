alter table vehicle_evaluations add column if not exists diagram_markers jsonb not null default '[]';
