# Login-page-and-admin-pannel

MERN login/register app with a protected admin dashboard.

## Features

- React login page
- React register page
- Protected admin panel
- Express API
- MongoDB user storage
- Password hashing with bcrypt
- JWT based login sessions
- Admin users table and login history

## Run locally

Install dependencies:

```powershell
npm.cmd install
```

Start backend:

```powershell
npm.cmd run server
```

Start frontend:

```powershell
npm.cmd run dev -- --host 127.0.0.1
```

Frontend:

```text
http://127.0.0.1:5173/login
http://127.0.0.1:5173/register
http://127.0.0.1:5173/admin
```

## Environment

Create a `.env` file from `.env.example` and set your admin login details.
