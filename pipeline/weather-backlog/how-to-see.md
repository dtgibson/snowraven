# Seeing the Weather Backlog locally

This new section lives at the bottom of the **Weather** tab. It lists the
checklists in your eBird data that still have no weather block, so you can work
down that backlog. Here is how to run the app and find it.

## 1. Open two terminals in your project folder

You need the backend and the frontend running at the same time, so open two
terminal windows (or two tabs), both in the `snowraven` project folder.

## 2. Start the backend (first terminal)

```
cd backend
uvicorn main:app --reload --port 1620
```

Leave it running. It should say it is serving on `http://localhost:1620`.

## 3. Start the frontend (second terminal)

```
cd frontend
npm run dev
```

Leave it running. It will print a local address, usually
`http://localhost:5173`.

## 4. Open the app in your browser

Go to:

```
http://localhost:5173
```

## 5. Make sure your data and keys are loaded

The backlog is built from your downloaded eBird data, and the "Copy weather &
go" action needs your API keys.

- If you haven't already, open **Settings** and import your eBird backup (your
  MyEBirdData export) and enter your **eBird** and **OpenWeather** API keys.
- If no backup is loaded, the backlog will show a "Load your eBird backup first"
  message instead of a list — that's expected.

## 6. Find and open the backlog

1. Click the **Weather** tab (it's usually the first tab).
2. Scroll to the very bottom of the tab, past the checklist lookup box and the
   Current / Predict panel.
3. Click the button labelled **List checklists with no weather blocks**.

The section expands in place. You'll see a heading, a count line, a toggle, and
a list of checklist rows.

## 7. What to look for

- **The list.** Your most-recent complete, non-incidental checklists that have
  no weather block, newest first. Each row shows the date, the location, the
  species count, and a second line with protocol, distance, duration, place, and
  "Complete."
- **The widen toggle.** Flip **Also show incomplete & incidental** on — the list
  grows to include those checklists too (they get a small "Incomplete" or
  "Incidental" chip and a faint background), and the count line updates.
- **The three buttons on each row:**
  - the first (icon) opens that checklist on eBird in a new tab,
  - the second (icon) opens that checklist's comment/edit page on eBird,
  - the green **Copy weather & go** button looks up that checklist's weather,
    copies it to your clipboard, and opens the comment page in a new tab — paste
    to add it. On success the button turns into "Copied · comment page opened."
- **Failures are honest.** If you're offline, or a key is missing, or the lookup
  errors, the row shows a clear message right there and does **not** open the
  comment page — so you never land on eBird with nothing to paste.
- **Paging.** If more than 100 checklists match, use **Show next 100** or **Show
  all** at the bottom of the list.

## 8. Tip: test the offline / missing-key behavior

- To see the offline state, turn off your network (or stop the backend in
  terminal 1) and click **Copy weather & go** on a row.
- To see the missing-key state, remove your OpenWeather key in Settings and try
  again. In both cases the comment page should stay closed and the row should
  explain why.
