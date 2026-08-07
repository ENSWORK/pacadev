#!/bin/bash
# setup-github-client.sh
# Crée et configure un repo GitHub pour un nouveau client PACADEV
# Usage: ./setup-github-client.sh <client-slug> [odoo-version]
set -euo pipefail

CLIENT="${1:-}"
ODOO="${2:-17}"
ORG="ENSWORK"

if [ -z "$CLIENT" ]; then
  echo "Usage: $0 <client-slug> [odoo-version]"
  exit 1
fi

REPO="${ORG}/pacadev-client-${CLIENT}"
echo "🔹 Setup GitHub client: $REPO (Odoo $ODOO)"

# 1. Créer le repo
echo ""
echo "📁 Création repo..."
gh repo create "$REPO" \
  --description "Client ${CLIENT} — Odoo ${ODOO} — PACADEV" \
  --private \
  --confirm 2>/dev/null || echo "  (repo déjà existant)"
echo "  ✅ $REPO"

# 2. Labels
echo ""
echo "🏷️  Labels..."
bash "$(dirname $0)/setup-github-labels.sh" "$REPO"

# 3. Milestones sprints (4 semaines)
echo ""
echo "📅 Milestones..."
python3 << PYEOF
import subprocess, json, urllib.request, urllib.error
from datetime import datetime, timedelta

token = subprocess.run(["gh", "auth", "token"], capture_output=True, text=True).stdout.strip()
today = datetime.now()
for i in range(4):
    d = today + timedelta(weeks=i)
    week = d.isocalendar()[1]; year = d.isocalendar()[0]
    m = {
        "title": f"Sprint {year}-W{week:02d}",
        "due_on": (d + timedelta(days=(6-d.weekday()))).strftime("%Y-%m-%dT23:59:59Z"),
    }
    req = urllib.request.Request(
        f"https://api.github.com/repos/${REPO}/milestones",
        data=json.dumps(m).encode(),
        headers={"Authorization": f"token {token}", "Content-Type": "application/json"},
        method="POST"
    )
    try:
        with urllib.request.urlopen(req) as r:
            print(f"  ✅ {json.loads(r.read())['title']}")
    except: pass
PYEOF

# 4. Branch protection
echo ""
echo "🔒 Protection branches..."
# Pousser d'abord main et staging depuis le template
CLIENT_DIR="/home/pacadev/pacadev/v${ODOO}/clients/${CLIENT}"
if [ -d "$CLIENT_DIR" ] && [ -d "$CLIENT_DIR/.git" ]; then
  cd "$CLIENT_DIR"
  git remote add origin "https://$(gh auth token)@github.com/${REPO}.git" 2>/dev/null || true
  git push -u origin main 2>/dev/null || true
  git checkout -b staging 2>/dev/null && git push -u origin staging 2>/dev/null || true
  git checkout main 2>/dev/null || true
fi

for BRANCH in main staging; do
  curl -s -X PUT \
    -H "Authorization: token $(gh auth token)" \
    -H "Accept: application/vnd.github.v3+json" \
    "https://api.github.com/repos/${REPO}/branches/${BRANCH}/protection" \
    -d '{
      "required_status_checks": {"strict": true, "contexts": ["lint","test"]},
      "enforce_admins": false,
      "required_pull_request_reviews": null,
      "restrictions": null,
      "allow_force_pushes": false
    }' > /dev/null 2>&1 && echo "  ✅ $BRANCH protégée" || echo "  ⚠️  $BRANCH (push d'abord requis)"
done

# 5. Secrets Actions
echo ""
echo "🔐 Secrets GitHub Actions..."
SOPS_KEY=$(cat ~/.config/sops/age/keys.txt | grep 'AGE-SECRET' | tr -d '\n')
gh secret set SOPS_AGE_KEY --body "$SOPS_KEY" --repo "$REPO" && echo "  ✅ SOPS_AGE_KEY"
gh variable set ODOO_VERSION --body "$ODOO" --repo "$REPO" && echo "  ✅ ODOO_VERSION"
gh variable set CLIENT_SLUG --body "$CLIENT" --repo "$REPO" && echo "  ✅ CLIENT_SLUG"

echo ""
echo "✅ Client GitHub prêt: https://github.com/${REPO}"
echo ""
echo "Prochaines étapes:"
echo "  1. pacadev init ${CLIENT} --odoo ${ODOO}"
echo "  2. pacadev generate devcontainer ${CLIENT}"
echo "  3. pacadev generate ci ${CLIENT}"
echo "  4. Ajouter secrets: ANTHROPIC_API_KEY, DEPLOY_SSH_KEY"
echo "     → https://github.com/${REPO}/settings/secrets/actions"
