# Smart WaterNet Frontend

This is a React + Vite frontend starter focused on the requested authentication flow:

- Login page
- Signup page
- 2FA verification page

## Design direction

The styling follows the Smart WaterNet proposal mockup direction:

- soft blue/cyan gradient background
- centered rounded white auth card
- water-drop branding
- rounded fields and gradient CTA button
- role-based inputs aligned with the project scope

## Run locally

```bash
npm install
npm run dev
```

Then open the local Vite URL shown in the terminal.

## Demo behavior

This frontend uses a demo auth context for preview.

- Login or signup moves to `/verify-2fa`
- 2FA demo code is: `123456`
- On success it moves to a simple dashboard-ready success screen

## Suggested backend integration

Replace the mock functions in:

```txt
src/context/AuthContext.jsx
```

with your real API calls.

If you want to connect it to your backend auth guide, wire these steps:

1. login/signup form submit
2. request challenge or auth session from backend
3. move user to 2FA page
4. verify OTP/challenge
5. store token and role

## Project structure

```txt
src/
  components/
  context/
  pages/
  styles/
```
