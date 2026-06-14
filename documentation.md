# Userbot-s Loyihasini O'rnatish va Ishga Tushirish Qo'llanmasi

Ushbu qo'llanma sizga dasturni qanday qilib serverlarga joylash (deploy) va kerakli muhit o'zgaruvchilarini (`.env`) qayerdan olish kerakligini bosqichma-bosqich tushuntiradi. Biz Backend uchun **Render**, Frontend uchun **Vercel**, Ma'lumotlar bazasi uchun **Neon.tech (Postgres)**, va Kesh hamda Navbatlar (Queues) uchun **Upstash (Redis)** dan foydalanamiz.

---

## 1. Kerakli Kalitlar va `.env` O'zgaruvchilarini Olish

Backend ishlashi uchun `.env` faylida quyidagi ma'lumotlar to'ldirilishi kerak:

### 1.1 Ma'lumotlar bazasi (Postgres - Neon.tech)
* **DATABASE_URL**: [Neon.tech](https://neon.tech/) saytida ro'yxatdan o'ting va yangi loyiha (project) yarating.
* Yaratilgandan so'ng, "Dashboard" qismida ulanish ssilkasi (Connection String) beriladi.
* Ssilka odatda shunday ko'rinishda bo'ladi: `postgresql://user:password@hostname/dbname?sslmode=require`
* Buni `.env` faylidagi `DATABASE_URL` ga joylang.

### 1.2 Redis (Upstash)
* **REDIS_URL**: [Upstash](https://upstash.com/) saytiga kiring va yangi "Redis Database" boshlang.
* "Details" qismida "Node" yoki "IORedis" bo'limiga o'tsangiz `rediss://...` bilan boshlanuvchi URL ni topasiz. Odatda `rediss://default:password@endpoint:port` shaklida bo'ladi.
* Shu URL ni to'liq ko'chirib, `.env` faylidagi `REDIS_URL` ga yozing.

### 1.3 Telegram Bot va MTProto Kalitlari
* **BOT_TOKEN**: Telegramda [@BotFather](https://t.me/BotFather) orqali yangi bot yarating va u bergan tokenni ko'chirib oling.
* **MEDIA_CHANNEL_ID**: Yangi shaxsiy (private) Telegram kanal yarating va botingizni u yerga admin qilib qo'shing. Kanal ID sini oling (u odatda `-100` bilan boshlanadi). Buni bilish uchun `@userinfobot` kabi botlardan yoki Telegram Web orqali foydalanishingiz mumkin.
* **TELEGRAM_API_ID** va **TELEGRAM_API_HASH**: [my.telegram.org](https://my.telegram.org) saytiga o'z raqamingiz bilan kiring. "API development tools" qismiga o'tib, yangi app (dastur) yarating. U yerdan `api_id` va `api_hash` ni oling.

### 1.4 Xavfsizlik Kalitlari (Security)
* **ENCRYPTION_MASTER_KEY**: Bu foydalanuvchilar sessiyalarini shifrlash (encrypt) uchun kerak. 64 ta belgidan iborat ixtiyoriy HEX kod yozing. Masalan, terminalda `openssl rand -hex 32` buyrug'ini yozib hosil qilsangiz bo'ladi.
* **WHITELISTED_USER_IDS**: Tizimga faqat ruxsat berilgan adminlarning Telegram ID raqamlari (vergul bilan ajratilgan holda, masalan: `123456789,987654321`).

### 1.5 LLM va Boshqa Sozlamalar
* **NODE_ENV**: Renderda avtomatik ravishda `production` bo'ladi.
* **CORS_ORIGIN**: Vercel da olingan Frontend manzilingiz (masalan, `https://userbot-frontend.vercel.app`).
* **GROQ_API_KEY**: [Groq Console](https://console.groq.com/) saytiga kirib, API kalit yarating va shuni yozing.

---

## 2. Backendni Joylash (Render) va Xatolarni To'g'rilash

Hozirda Renderda deploy xatosi (fail) bo'lishiga asosiy sabab — loyiha Monorepo usulida (`backend` va `frontend` papkalarga ajratilgan) tuzilgan bo'lib, **Root Directory** (Asosiy papka) va **Prisma migratsiya buyruqlari** to'g'ri ko'rsatilmaganidadir.
Bundan tashqari, Renderning bepul versiyasi 15 daqiqadan so'ng "uxlab" qolmasligi uchun kod bazasiga maxsus **Keep-Alive ping** xizmati qo'shib qo'yildi! U har 14 daqiqada avtomatik ravishda o'zini uyg'otib turadi.

### Render Sozlamalari (To'g'ri Deploy qilish va Xatoni tuzatish):
1. Render platformasida yangi **Web Service** yarating.
2. Github repozitoriyangizni ulang.
3. Quyidagi sozlamalarni **aynan shunday** kiriting:
   - **Name**: `userbot-backend` (yoki ixtiyoriy)
   - **Environment**: `Node`
   - **Root Directory**: `backend` *(Juda muhim! Shuni yozmasangiz xato beradi)*
   - **Build Command**: `npm install && npm run db:generate && npm run build`
   - **Start Command**: `npx prisma migrate deploy && npm start`
4. **Environment Variables (Muhit o'zgaruvchilari)** qismiga o'ting va yuqoridagi 1-bo'limda tushuntirilgan barcha `.env` kalitlarini bittalab kiritib chiqing.
5. Deploy tugmasini bosing!

> **Muhim eslatma:** `npx prisma migrate deploy` buyrug'i `Start Command` ichida turgani muhim. Chunki u har safar server yonganda ma'lumotlar bazasi jadvallarini avtomatik yaratadi.

---

## 3. Frontendni Joylash (Vercel)

Frontend (Angular) qismini Vercelda ishlashini ta'minlash ancha oson.

1. [Vercel.com](https://vercel.com/) saytiga kiring va "Add New Project" ni bosing.
2. Github repozitoriyangizni import qiling.
3. **Framework Preset** sifatida `Angular` avtomat tanlanadi.
4. **Root Directory**: Shu qismda `Edit` tugmasini bosib, ro'yxatdan `frontend` papkasini tanlang.
5. Deploy tugmasini bosing.
6. Deploy tugagandan so'ng, Vercel sizga `https://...vercel.app` ssilkasini beradi.
7. Vercel sizga bergan ssilkani oling-da, Render platformasiga qaytib kirib, **CORS_ORIGIN** environment variable ichiga shu manzilni qo'yib, Renderni qayta ishga tushiring (Restart service). Bu orqali Frontend tizimi Backend bilan muammosiz bog'lanadi.

Shu bilan loyiha to'liq va uzluksiz ishlashga tayyor!
