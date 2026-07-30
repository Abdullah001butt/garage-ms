alter table vehicles add column if not exists emirate text not null default 'Ajman'
  check (emirate in ('Abu Dhabi', 'Dubai', 'Sharjah', 'Ajman', 'Umm Al Quwain', 'Ras Al Khaimah', 'Fujairah'));
