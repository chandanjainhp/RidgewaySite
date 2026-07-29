# MongoDB backup

Manual backup (run from a host with `mongodump` and network access to MongoDB):

```bash
# One-off dump
mongodump \
  --uri="${MONGODB_URL}" \
  --out="/var/backups/sentinel/$(date +%Y%m%d-%H%M%S)"

# Example cron (daily at 02:15 UTC) — adjust paths and URI
# 15 2 * * * mongodump --uri="$MONGODB_URL" --out="/var/backups/sentinel/$(date +\%Y\%m\%d)" && find /var/backups/sentinel -maxdepth 1 -type d -mtime +14 -exec rm -rf {} +
```

Restore:

```bash
mongorestore --uri="${MONGODB_URL}" --drop /path/to/dump/sentinel
```

Store dumps off-box and restrict filesystem permissions on backup directories.
