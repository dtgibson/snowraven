# Product Brief — SnowRaven

## What This Is
A lightweight, self-hosted web app that accepts an eBird checklist number and returns a formatted block of historical weather data — ready to paste directly into an eBird checklist comment field.

## The Problem
Birders who want to add weather context to their eBird checklists rely on tools like raincrow.app, but that service imposes rate limits and could disappear at any time. There's no easy way to own this workflow yourself.

## Who It's For
The user is a birder who logs observations on eBird and wants weather data as part of their checklist records. They're comfortable enough with self-hosting to run something on a Raspberry Pi or a local machine. A small circle of birding friends might use it too.

## Why It Should Exist
raincrow.app proves the concept works and that birders want it — this is a personal, resilient version of that same tool. The insight is simple: owning the API keys and hosting means no rate limits, no dependency on a third-party service staying alive, and full control over the output format.

## What Success Looks Like
The user can paste an eBird checklist URL or number into the app, click a button, and immediately get a formatted weather block — emoji, conditions, temperature, wind, humidity, sunrise/sunset — ready to copy and paste. It runs reliably on a Raspberry Pi or local machine with no cloud dependencies beyond the OpenWeather API.

## Founding Decisions
- Self-hosted first — designed to run on Raspberry Pi or localhost, not a cloud platform
- Personal and small-group use, not a public service
- Output format matches raincrow.app convention (emoji + structured text block)
- Data source: OpenWeather historical API
- Input: eBird checklist number (app fetches time + location from eBird API)
- Single-page, single-purpose — no accounts, no dashboards, no extras

## Out of Scope
- User accounts or authentication
- Saved checklist history
- Mobile app
- Support for weather providers other than OpenWeather
- Any feature not present in the raincrow.app output format
