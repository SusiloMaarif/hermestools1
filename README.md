# OmniRoute Telegram Mini App

Mini app Telegram + Vite React.

Default OmniRoute Base URL:

```txt
http://124.156.205.89:20129/v1
```

## Run local

```bash
npm install
npm run dev
```

## Deploy Vercel

- Framework: Vite
- Build Command: `npm run build`
- Output Directory: `dist`
- Install Command: `npm install`

## Catatan penting

Telegram/Vercel berjalan HTTPS. Jika router masih HTTP, browser dapat memblokir request karena mixed content. Untuk production, pasang HTTPS reverse proxy atau Cloudflare Tunnel ke `http://localhost:20129`.

CC Tools di project ini hanya Luhn validator/generator offline untuk test number format, bukan checker kartu aktif/transaksi.
