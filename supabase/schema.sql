-- 모의고사 정보 테이블 생성
create table exams (
  id bigint generated by default as identity primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  exam_name text not null,
  round integer not null,
  unique(exam_name, round)
);

-- 학생 정보 테이블 생성
create table students (
  id bigint generated by default as identity primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  student_name text not null unique
);

-- 모의고사 성적 테이블 생성 (정규화된 버전)
create table exam_scores_normalized (
  id bigint generated by default as identity primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  exam_id bigint references exams(id) not null,
  student_id bigint references students(id) not null,
  score integer not null,
  unique(exam_id, student_id)
);

-- 기존 데이터 마이그레이션을 위한 함수
create or replace function migrate_data() returns void as $$
declare
  v_exam_id bigint;
  v_student_id bigint;
  v_score record;
begin
  -- 학생 데이터 마이그레이션
  insert into students (student_name)
  select distinct student_name from exam_scores
  on conflict (student_name) do nothing;

  -- 모의고사 데이터 마이그레이션
  for v_score in select distinct exam_name, round from exam_scores loop
    insert into exams (exam_name, round)
    values (v_score.exam_name, v_score.round)
    returning id into v_exam_id;

    -- 성적 데이터 마이그레이션
    for v_score in 
      select s.id as student_id, es.score
      from exam_scores es
      join students s on s.student_name = es.student_name
      where es.exam_name = v_score.exam_name and es.round = v_score.round
    loop
      insert into exam_scores_normalized (exam_id, student_id, score)
      values (v_exam_id, v_score.student_id, v_score.score);
    end loop;
  end loop;
end;
$$ language plpgsql;

-- RLS(Row Level Security) 정책 설정
alter table exams enable row level security;
alter table students enable row level security;
alter table exam_scores_normalized enable row level security;

-- 모든 사용자가 읽기 가능하도록 정책 설정
create policy "모든 사용자가 모의고사 정보를 볼 수 있음" on exams
  for select using (true);

create policy "모든 사용자가 학생 정보를 볼 수 있음" on students
  for select using (true);

create policy "모든 사용자가 성적을 볼 수 있음" on exam_scores_normalized
  for select using (true);

-- 인증된 사용자만 데이터를 추가할 수 있도록 정책 설정
create policy "인증된 사용자만 모의고사 정보를 추가할 수 있음" on exams
  for insert with check (auth.role() = 'authenticated');

create policy "인증된 사용자만 학생 정보를 추가할 수 있음" on students
  for insert with check (auth.role() = 'authenticated');

create policy "인증된 사용자만 성적을 추가할 수 있음" on exam_scores_normalized
  for insert with check (auth.role() = 'authenticated');

-- 인덱스 생성
create index exam_scores_normalized_exam_id_idx on exam_scores_normalized(exam_id);
create index exam_scores_normalized_student_id_idx on exam_scores_normalized(student_id);
create index exams_exam_name_round_idx on exams(exam_name, round);
create index students_student_name_idx on students(student_name);

-- 마이그레이션 실행
select migrate_data();

-- 기존 테이블 삭제 (마이그레이션이 성공적으로 완료된 후에 실행)
-- drop table exam_scores; 