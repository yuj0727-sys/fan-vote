#!/usr/bin/env bash
# SQL 파일 앞에 EXPLAIN (ANALYZE, BUFFERS)를 붙여 반복 실행하고
# 콜드 회차, 워밍업 이후 중앙값, 마지막 실행 계획을 출력한다.
set -euo pipefail

# docker-compose.yml의 서비스 이름은 postgres다.
postgres_service="postgres"
default_repeat_count=6

usage() {
  echo "사용법: perf/measure.sh <sql파일> [반복횟수]" >&2
  echo "반복횟수 기본값은 ${default_repeat_count}이다. 1회차는 콜드로 표시하고, 나머지 회차의 중앙값을 출력한다." >&2
}

if [[ $# -lt 1 || $# -gt 2 ]]; then
  usage
  exit 1
fi

sql_file_arg=$1
repeat_count=${2:-$default_repeat_count}

if [[ ! "$repeat_count" =~ ^[1-9][0-9]*$ ]]; then
  echo "반복 횟수는 양의 정수여야 합니다: ${repeat_count}" >&2
  exit 1
fi

if [[ ! -f "$sql_file_arg" ]]; then
  echo "SQL 파일을 찾을 수 없습니다: ${sql_file_arg}" >&2
  exit 1
fi

sql_file=$(cd "$(dirname "$sql_file_arg")" && pwd)/$(basename "$sql_file_arg")
project_root=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
cd "$project_root"

if [[ ! -f .env ]]; then
  echo ".env 파일이 없습니다." >&2
  exit 1
fi

read_env_value() {
  local key=$1
  local line value
  while IFS= read -r line || [[ -n "$line" ]]; do
    case "$line" in
      "${key}="*)
        value=${line#"${key}="}
        value=${value%$'\r'}
        if [[ ${#value} -ge 2 && "$value" == \"*\" ]]; then
          value=${value:1:${#value}-2}
        elif [[ ${#value} -ge 2 && "$value" == \'*\' ]]; then
          value=${value:1:${#value}-2}
        fi
        printf '%s' "$value"
        return 0
        ;;
    esac
  done < .env
  return 1
}

DB_USER=$(read_env_value DB_USER) || {
  echo ".env에 DB_USER가 없습니다." >&2
  exit 1
}
DB_PASSWORD=$(read_env_value DB_PASSWORD) || {
  echo ".env에 DB_PASSWORD가 없습니다." >&2
  exit 1
}
DB_NAME=$(read_env_value DB_NAME) || {
  echo ".env에 DB_NAME이 없습니다." >&2
  exit 1
}

if [[ -z "$DB_USER" || -z "$DB_NAME" ]]; then
  echo ".env의 DB_USER와 DB_NAME은 비어 있을 수 없습니다." >&2
  exit 1
fi

run_explain() {
  {
    printf '%s\n' 'EXPLAIN (ANALYZE, BUFFERS)'
    cat "$sql_file"
  } | docker compose exec -T \
    -e "PGPASSWORD=${DB_PASSWORD}" \
    "$postgres_service" \
    psql -X -v ON_ERROR_STOP=1 -U "$DB_USER" -d "$DB_NAME"
}

execution_time_of() {
  awk '/Execution Time:/ { time = $3 } END { print time }'
}

median_of() {
  awk '
    {
      values[NR] = $1 + 0
    }
    END {
      count = NR
      if (count == 0) {
        exit 1
      }
      for (left = 1; left <= count; left++) {
        for (right = left + 1; right <= count; right++) {
          if (values[right] < values[left]) {
            swap = values[left]
            values[left] = values[right]
            values[right] = swap
          }
        }
      }
      if (count % 2 == 1) {
        printf "%.3f\n", values[(count + 1) / 2]
      } else {
        printf "%.3f\n", (values[count / 2] + values[count / 2 + 1]) / 2
      }
    }
  '
}

echo "파일: ${sql_file}"
echo "반복: ${repeat_count}"
echo

warm_times=()
last_plan=""

for run_index in $(seq 1 "$repeat_count"); do
  plan_output=$(run_explain) || exit 1
  execution_time=$(printf '%s\n' "$plan_output" | execution_time_of)
  if [[ -z "$execution_time" ]]; then
    echo "Execution Time을 찾지 못했습니다." >&2
    printf '%s\n' "$plan_output" >&2
    exit 1
  fi

  if [[ "$run_index" -eq 1 ]]; then
    printf '[%d/%d] 콜드  %s ms\n' "$run_index" "$repeat_count" "$execution_time"
  else
    printf '[%d/%d]       %s ms\n' "$run_index" "$repeat_count" "$execution_time"
    warm_times+=("$execution_time")
  fi

  if [[ "$run_index" -eq "$repeat_count" ]]; then
    last_plan=$plan_output
  fi
done

echo
if [[ ${#warm_times[@]} -eq 0 ]]; then
  echo "중앙값: 콜드 회차만 있어 계산하지 않습니다."
else
  median=$(printf '%s\n' "${warm_times[@]}" | median_of)
  echo "중앙값 (2~${repeat_count}회, 콜드 제외): ${median} ms"
fi

echo
echo "마지막 회차 실행 계획:"
printf '%s\n' "$last_plan"
