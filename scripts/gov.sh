#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════
# scripts/gov.sh — أداة الحوكمة متعدّدة الجلسات (المادة ٦ و٧ و٨ من الدستور)
#
# الحجز الذرّي: ملف القفل locks/TASK-XXXX.lock يُلتزَم ويُدفَع إلى فرع التنسيق.
# دفعُ Git عمليةُ «قارن ثمّ بدّل» على المرجع البعيد: إن سبقتك جلسةٌ أخرى يُرفض
# دفعك (non-fast-forward)، فتجلب حالتها وتعيد الفحص — فلا تفوز بالمهمة نفسها
# جلستان أبداً. القراءة ثمّ الكتابة وحدها ليست حجزاً؛ الحجز = الدفع الناجح.
#
# الاستعمال:
#   scripts/gov.sh start                     بروتوكول الاستلام (المادة ٨): حالة Git والأقفال والتسليمات
#   scripts/gov.sh claim TASK-0123 "f1 f2"   حجز مهمة وملفّاتها (يتطلّب شجرة عمل نظيفة)
#   scripts/gov.sh release TASK-0123         تحرير حجزٍ تملكه هذه الجلسة
#   scripts/gov.sh takeover TASK-0123 "سبب"  استلام حجز جلسةٍ ثبت توقّفها (يُسجَّل السبب في القفل)
#   scripts/gov.sh locks                     الأقفال النشطة
#   scripts/gov.sh next-id                   أوّل معرّف TASK غير مستعمل (ثبّته بـ claim فوراً)
#
# المتغيّرات: GOV_COORD_BRANCH (يتقدّم على scripts/gov.conf) · GOV_SESSION (معرّف الجلسة)
# ═══════════════════════════════════════════════════════════════════════════
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"
CONF="$ROOT/scripts/gov.conf"
[ -f "$CONF" ] && . "$CONF"
COORD="${GOV_COORD_BRANCH:-${COORD_BRANCH:-}}"
REMOTE="${GOV_REMOTE:-origin}"
LOCKDIR="locks"

session_id() {
  if [ -n "${GOV_SESSION:-}" ]; then echo "$GOV_SESSION"; return; fi
  # جلسات Claude Code السحابية: cse_XXXX في عنوان الـ SDK ⇐ session_XXXX (رابط الجلسة)
  if [ -n "${CLAUDE_CODE_REMOTE_SDK_URL:-}" ]; then
    local s="${CLAUDE_CODE_REMOTE_SDK_URL##*/}"; echo "session_${s#cse_}"; return
  fi
  echo "local-$(hostname)-$(git config user.name | tr ' ' '_')"
}
ME="$(session_id)"
now() { date -u +%Y-%m-%dT%H:%M:%SZ; }
die() { echo "✖ $*" >&2; exit 1; }

need_coord() {
  [ -n "$COORD" ] || die "فرع التنسيق غير معرَّف (scripts/gov.conf أو GOV_COORD_BRANCH)."
  local cur; cur="$(git branch --show-current)"
  [ "$cur" = "$COORD" ] || die "أنت على «$cur» وفرع التنسيق «$COORD». الحجز يجب أن يُدفع إلى فرع التنسيق نفسه (انظر الدستور، المادة ٩)."
}
need_clean() {
  git diff --quiet && git diff --cached --quiet || die "في شجرة العمل تعديلات غير ملتزَمة. التزم بها أو احفظها أولاً — الحجز يُلتزَم وحده."
}
sync_ff() {
  git fetch -q "$REMOTE" "$COORD"
  git merge -q --ff-only "$REMOTE/$COORD" 2>/dev/null \
    || die "الفرع المحلّي تباعد عن $REMOTE/$COORD. ادمج يدوياً بعد الفحص (لا reset --hard)."
}
remote_has() { git cat-file -e "$REMOTE/$COORD:$1" 2>/dev/null; }

# يدفع الالتزام الأخير (تغيير القفل) — وعند الرفض يجلب ويعيد الفحص ثمّ يعيد المحاولة
push_lock_commit() {
  local path="$1" mode="$2" i
  for i in 1 2 3 4; do
    if git push -q "$REMOTE" "HEAD:$COORD" 2>/dev/null; then return 0; fi
    git fetch -q "$REMOTE" "$COORD"
    if [ "$mode" = claim ] && remote_has "$path"; then
      git reset -q --soft HEAD~1; git restore -q --staged "$path"; rm -f "$path"
      die "خسرت السباق: $(basename "$path" .lock) حُجزت للتوّ من: $(git show "$REMOTE/$COORD:$path" | sed -n 's/^session: //p')"
    fi
    git rebase -q "$REMOTE/$COORD" || { git rebase --abort; die "تعذّرت إعادة التأسيس على $REMOTE/$COORD — افحص يدوياً."; }
    sleep $((2 ** i))
  done
  die "فشل الدفع بعد ٤ محاولات (شبكة؟). الالتزام المحلّي باقٍ: أعد «git push $REMOTE HEAD:$COORD» يدوياً — الحجز غير مضمون حتى ينجح."
}

valid_id() { [[ "$1" =~ ^TASK-[0-9]{4}$ ]] || die "معرّف غير صالح: $1 (الصيغة TASK-0123)"; }

cmd_claim() {
  local id="$1" files="${2:-}"; valid_id "$id"
  need_coord; need_clean; sync_ff
  local f="$LOCKDIR/$id.lock"
  if [ -f "$f" ]; then cat "$f" >&2; die "$id محجوزة مسبقاً (أعلاه)."; fi
  mkdir -p "$LOCKDIR"
  printf 'task: %s\nsession: %s\nbranch: %s\nfiles: %s\nclaimed_at: %s\nstatus: ACTIVE\nrelease: scripts/gov.sh release %s\n' \
    "$id" "$ME" "$COORD" "$files" "$(now)" "$id" > "$f"
  git add "$f"; git commit -q -m "حجز $id للجلسة $ME" -- "$f"
  push_lock_commit "$f" claim
  echo "✔ حُجزت $id للجلسة $ME (مدفوع إلى $REMOTE/$COORD)."
}

cmd_release() {
  local id="$1" force="${2:-}"; valid_id "$id"
  need_coord; need_clean; sync_ff
  local f="$LOCKDIR/$id.lock"
  [ -f "$f" ] || die "لا قفل لـ $id."
  local owner; owner="$(sed -n 's/^session: //p' "$f")"
  [ "$owner" = "$ME" ] || [ -n "$force" ] || die "$id يملكها $owner لا $ME. استعمل takeover بسببٍ موثّق بعد التحقّق من توقّفها."
  git rm -q "$f"; git commit -q -m "تحرير $id (الجلسة $ME)"
  push_lock_commit "$f" release
  echo "✔ حُرّر $id."
}

cmd_takeover() {
  local id="$1" reason="${2:-}"; valid_id "$id"
  [ -n "$reason" ] || die "takeover يتطلّب سبباً موثّقاً (دليل توقّف الجلسة السابقة)."
  need_coord; need_clean; sync_ff
  local f="$LOCKDIR/$id.lock"
  [ -f "$f" ] || die "لا قفل لـ $id — استعمل claim."
  local prev; prev="$(sed -n 's/^session: //p' "$f")"
  { sed -e "s/^session: .*/session: $ME/" -e "s/^claimed_at: .*/claimed_at: $(now)/" "$f"
    printf 'taken_over_from: %s\ntakeover_reason: %s\n' "$prev" "$reason"; } > "$f.tmp" && mv "$f.tmp" "$f"
  git add "$f"; git commit -q -m "استلام $id من $prev إلى $ME: $reason" -- "$f"
  push_lock_commit "$f" takeover
  echo "✔ استُلمت $id من $prev."
}

cmd_locks() {
  shopt -s nullglob; local any=0
  for f in "$LOCKDIR"/*.lock; do any=1; echo "── $f"; cat "$f"; done
  [ $any = 1 ] || echo "(لا أقفال نشطة)"
}

cmd_next_id() {
  local max
  max="$( { grep -rhoE 'TASK-[0-9]{4}' TASK_REGISTRY.md handoffs "$LOCKDIR" </dev/null 2>/dev/null || true; } | sed 's/TASK-//' | awk '$1>=100 && $1<700' | sort -n | tail -1)"
  # المجال 0100–0699 للمهام الجديدة؛ 0001–0099 و07xx–09xx محجوزة للمنقول من السجل القديم
  printf 'TASK-%04d\n' $((10#${max:-99} + 1))
}

cmd_start() {
  echo "الجلسة: $ME · فرع التنسيق: ${COORD:-غير معرَّف} · الفرع الحالي: $(git branch --show-current)"
  if [ -n "$COORD" ]; then
    git fetch -q "$REMOTE" "$COORD" && echo "متقدّم/متأخّر عن $REMOTE/$COORD: $(git rev-list --left-right --count "HEAD...$REMOTE/$COORD" | tr '\t' '/')"
  fi
  echo; echo "═ git status"; git status -sb | head -30
  echo; echo "═ الأقفال النشطة (المحلّية — بعد المزامنة تعكس الواقع)"; cmd_locks
  echo; echo "═ التسليمات المفتوحة"
  shopt -s nullglob; local hf=(handoffs/TASK-*.md)
  if [ ${#hf[@]} -gt 0 ]; then grep -lE '^- \*\*الحالة:\*\* `?(HANDOFF_READY|BLOCKED|IN_PROGRESS)' "${hf[@]}" || echo "(لا شيء)"; else echo "(لا شيء)"; fi
  echo; echo "═ مهام غير منتهية في السجل"
  awk '/^### TASK-/{h=$0} /\*\*الحالة:\*\*/ && h && match($0,/`(CLAIMED|IN_PROGRESS|HANDOFF_READY|VERIFYING|BLOCKED)`/){print h"  ⇐ "substr($0,RSTART,RLENGTH); h=""}' TASK_REGISTRY.md
  echo "(المتوقّفة BLOCKED والمعلّقة PENDING في جداول TASK_REGISTRY.md)"
  echo; echo "التالي: طابق ما سبق مع الملفات الفعلية قبل أي تعديل (المادة ٨ · البند ٦)."
}

case "${1:-}" in
  start)    cmd_start ;;
  claim)    shift; cmd_claim "${1:?المعرّف}" "${2:-}" ;;
  release)  shift; cmd_release "${1:?المعرّف}" ;;
  takeover) shift; cmd_takeover "${1:?المعرّف}" "${2:-}" ;;
  locks)    cmd_locks ;;
  next-id)  cmd_next_id ;;
  *) sed -n '2,20p' "$0"; exit 1 ;;
esac
