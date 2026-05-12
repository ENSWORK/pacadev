#!/bin/bash
# setup-github-labels.sh
# Usage: ./setup-github-labels.sh <owner/repo>
# Exemple: ./setup-github-labels.sh enswork/pacadev-core
set -euo pipefail

REPO="${1:-}"
if [ -z "$REPO" ]; then
  echo "Usage: $0 <owner/repo>"
  exit 1
fi

echo "🏷️  Configuration labels GitHub pour: $REPO"

create_label() {
  local name="$1" color="$2" desc="$3"
  gh label create "$name" --color "$color" --description "$desc" --repo "$REPO" --force 2>/dev/null \
    && echo "  ✅ $name" \
    || echo "  ⚠️  $name (déjà existant ou erreur)"
}

echo ""
echo "--- Types ---"
create_label "type:feature"   "0075ca" "Nouvelle fonctionnalité"
create_label "type:bug"       "d73a4a" "Correction de bug"
create_label "type:refactor"  "e4e669" "Refactoring sans changement fonctionnel"
create_label "type:migration" "f9d0c4" "Migration base de données"
create_label "type:incident"  "b60205" "Incident production"
create_label "type:docs"      "0052cc" "Documentation"

echo ""
echo "--- Statuts ---"
create_label "status:triage"          "ededed" "En attente de qualification"
create_label "status:ready"           "0e8a16" "Prêt pour développement"
create_label "status:in-progress"     "fbca04" "En cours de développement"
create_label "status:review"          "006b75" "En attente de review"
create_label "status:staging"         "1d76db" "Déployé sur staging"
create_label "status:ready-for-client" "0e8a16" "En attente validation client"
create_label "status:validated"       "0e8a16" "Validé — prêt pour production"
create_label "status:blocked"         "b60205" "Bloqué"

echo ""
echo "--- Priorités ---"
create_label "priority:p0"  "b60205" "Critique — production down"
create_label "priority:p1"  "e99695" "Majeur — fonctionnalité bloquée"
create_label "priority:p2"  "f9d0c4" "Modéré — contournement possible"
create_label "priority:p3"  "fef2c0" "Mineur"

echo ""
echo "--- Clients (exemples — adapter) ---"
create_label "client:acmecorp"  "5319e7" "Client acmecorp"

echo ""
echo "--- IA ---"
create_label "ai:risk-low"    "0e8a16" "Score IA < 0.3"
create_label "ai:risk-medium" "fbca04" "Score IA 0.3–0.5"
create_label "ai:risk-high"   "b60205" "Score IA > 0.5"
create_label "ai:auto-merged" "0e8a16" "Mergé automatiquement par IA"

echo ""
echo "✅ Labels configurés sur $REPO"
