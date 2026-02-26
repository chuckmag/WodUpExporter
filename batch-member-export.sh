#!/bin/bash

# Batch Member Export Script
# Exports WodUp data for multiple members who have given consent

# IMPORTANT: Add member usernames to the list below
# Only include members who have given you explicit permission!

# Your session token
if [ -z "$SESSION_TOKEN" ]; then
  echo "❌ SESSION_TOKEN not set"
  echo ""
  echo "Usage:"
  echo "  SESSION_TOKEN=\"your_token_here\" ./batch-member-export.sh"
  echo ""
  exit 1
fi

# List of members who have given consent (edit this list)
MEMBERS=(
  "bryanash"
  # Add more usernames here as you get permission
  # "username2"
  # "username3"
)

echo "=========================================="
echo "Batch Member Export"
echo "=========================================="
echo ""
echo "Exporting data for ${#MEMBERS[@]} members"
echo ""

CONSENT_LOG="OverrideMemberExports/CONSENT-LOG.txt"

# Create consent log header if it doesn't exist
if [ ! -f "$CONSENT_LOG" ]; then
  cat > "$CONSENT_LOG" << 'EOF'
WodUp Export Consent Log
========================

This file documents which members have given permission
for their public workout data to be exported.

EOF
fi

# Export for each member
for username in "${MEMBERS[@]}"; do
  echo "----------------------------------------"
  echo "Exporting: @$username"
  echo "----------------------------------------"

  SESSION_TOKEN="$SESSION_TOKEN" node wodup-member-export.js "$username"

  if [ $? -eq 0 ]; then
    echo "✓ Export complete for @$username"

    # Log to consent file
    echo "" >> "$CONSENT_LOG"
    echo "Member: @$username" >> "$CONSENT_LOG"
    echo "Export date: $(date '+%Y-%m-%d %H:%M:%S')" >> "$CONSENT_LOG"
    echo "Status: Completed successfully" >> "$CONSENT_LOG"
  else
    echo "❌ Export failed for @$username"
  fi

  echo ""

  # Wait between exports to be nice to the API
  sleep 3
done

echo "=========================================="
echo "Batch Export Complete!"
echo "=========================================="
echo ""
echo "Check the OverrideMemberExports/ directory for all files"
echo ""
echo "Files created:"
ls -1 OverrideMemberExports/*OverrideImport.csv 2>/dev/null || echo "  (No CSV files found)"
echo ""
