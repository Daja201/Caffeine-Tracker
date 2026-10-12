# energy-tracker

Pure black/white self-hosted energy drink log. No auth (LAN/VPN use only).

## Run

```
docker compose up -d --build
```

Then open `http://<server-ip>:3000`.

Data (SQLite file) persists in `./data` on the host via the compose volume.

## Config

- Edit `TZ` in `docker-compose.yml` to your server's timezone — the "day" logged
  for each entry is computed from the container's local date.
- Change the published port by editing the `ports:` mapping (`"3000:3000"`).

## Notes

- Caffeine and sugar are entered as per-100ml values; the app multiplies by the
  size you drank to compute totals.
- Price is never stored on a preset — it's always typed per entry, even when
  using a preset (defaults to required, can be 0).
- `#idx` is a permanent auto-incrementing id assigned at creation time; it is
  not renumbered if you delete older entries.
- Tap/click an entry in the list to edit any field or delete it (confirmation
  prompt shown before deleting).
- Long-press (or right-click on desktop) a preset chip to edit/delete it;
  "+ preset" creates a new one. Presets have no price field.
- The top dropdown (today/week/month/year/all) drives both the summary line
  and the list below it.
