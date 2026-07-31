---
name: testing-bms-dashboard
description: Test the BMS Dashboard UI end-to-end. Use when verifying telemetry display, MOSFET indicators, mode toggles, or diagnostic simulation changes.
---

# Testing the BMS Dashboard

## Overview

The BMS Dashboard is a Next.js app that displays Battery Management System telemetry. It has two modes:
- **Local Diagnostics** (default): Simulates BMS data with a 60-second cycle
- **Remote Gateway**: Connects to an MQTT broker (`wss://broker.hivemq.com:8884/mqtt`) for real telemetry

## Devin Secrets Needed

No secrets required — the app runs entirely client-side with a public MQTT broker.

## Environment

- **Preview deployments**: Netlify auto-deploys PR previews at `https://deploy-preview-{PR_NUMBER}--taras-bms-dashboard.netlify.app`
- **Local dev**: `npm install && npm run dev` → http://localhost:3000
- **Build check**: `npm run build`
- **Lint check**: `npm run lint`

## Diagnostic Simulation Cycle

The local diagnostic engine runs a **60-second repeating cycle** based on wall clock time:
- **0–27s (45%)**: CHARGING — positive current, SOC increases
- **27–54s (45%)**: DISCHARGING — negative current, SOC decreases
- **54–60s (10%)**: IDLE — zero current, cells drift toward equilibrium

To test state transitions, observe the dashboard for at least 60 seconds to see all three phases.

## Key UI Sections to Test

### Header
- Mode toggle button: switches between `[ LOCAL DIAGNOSTICS ]` and `REMOTE GATEWAY`
- Connection status indicator: `GATEWAY ONLINE` / `ESTABLISHING LINK...` / `GATEWAY OFFLINE`
- Terminal console toggle (icon button): shows MQTT/diagnostic logs

### Main Battery Section
- SOC percentage and battery visualization
- Status badge: `CHARGING` / `DISCHARGING` / `IDLE`
- Power flow, pack current, pack voltage, remaining energy
- Mode (DAY/NIGHT), relay status, cycle count, uptime

### TEMPERATURES & HARDWARE (GROUP_01)
- MOSFET temperature bar
- Battery cell temps T1, T2
- **CHARGE MOS** and **DISCHARGE MOS** indicators — these toggle between ACTIVE (green) and OFF (gray) based on current direction
- Safety diagnostics alarm status

### ELECTRICAL TELEMETRY (GROUP_02)
- Individual cell voltages (C1–C4) with MIN/MAX badges
- Remaining capacity and system energy

### SYSTEM ANALYTICS (GROUP_03)
- Max/min cell voltage, delta, average
- Cell balancer status (ACTIVE/IDLE with bypass current)

## Common Test Scenarios

1. **MOSFET indicator verification**: Watch through a full 60s cycle. During CHARGING, CHARGE MOS should be ACTIVE and DISCHARGE MOS should be OFF. During DISCHARGING, the opposite.
2. **Mode toggle**: Click the mode button to switch between diagnostic and remote. Dashboard should not crash. When switching to remote, connection status may show ESTABLISHING LINK before connecting.
3. **Console errors**: Check browser console for React errors or unhandled exceptions after the dashboard loads.
4. **Alarm states**: These might trigger if the simulation produces extreme values (e.g., high MOSFET temp > 65°C, cell delta > 0.08V, SOC < 10%).

## Tips

- The simulation updates every 1 second, so screenshots taken a few seconds apart will show different values.
- Cell voltages are clamped between 2.75V and ~3.64V.
- The app uses `output: 'export'` in next.config.ts (static export), so there's no server-side rendering to test.
