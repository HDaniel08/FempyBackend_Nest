import { Controller, Get, Res } from '@nestjs/common';
import type { Response } from 'express';

@Controller()
export class PublicController {
  @Get('privacy')
  getPrivacy(@Res() res: Response) {
    const html = `
<!DOCTYPE html>
<html lang="hu">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Adatkezelési Tájékoztató - Fempy</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background: #f7f8fb;
      color: #1f2937;
      font-family: Arial, Helvetica, sans-serif;
      line-height: 1.65;
    }
    .container {
      max-width: 900px;
      margin: 40px auto;
      padding: 32px;
      background: #ffffff;
      border-radius: 16px;
      box-shadow: 0 8px 30px rgba(0,0,0,0.08);
    }
    h1, h2 {
      color: #111827;
    }
    h1 {
      font-size: 32px;
      margin-bottom: 8px;
    }
    h2 {
      font-size: 22px;
      margin-top: 32px;
      margin-bottom: 12px;
    }
    p, li {
      font-size: 16px;
    }
    ul {
      padding-left: 20px;
    }
    .muted {
      color: #6b7280;
      margin-bottom: 24px;
    }
    a {
      color: #2563eb;
      text-decoration: none;
    }
    a:hover {
      text-decoration: underline;
    }
    .footer {
      margin-top: 32px;
      padding-top: 16px;
      border-top: 1px solid #e5e7eb;
      color: #6b7280;
      font-size: 14px;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>Adatkezelési Tájékoztató</h1>
    <p class="muted">
      Hatályos: 2026-04-20
    </p>

    <h2>1. Bevezetés</h2>
    <p>
      Jelen adatkezelési tájékoztató bemutatja, hogyan kezeli a Fempy alkalmazás
      a felhasználók személyes adatait. Elkötelezettek vagyunk a személyes adatok
      védelme és a vonatkozó adatvédelmi jogszabályok, különösen a GDPR előírásainak
      betartása mellett.
    </p>

    <h2>2. Kezelt adatok köre</h2>
    <ul>
      <li>név</li>
      <li>email cím</li>
      <li>szervezeti és pozíció adatok</li>
      <li>felhasználói válaszok, kérdőívek, hangulatértékelések</li>
      <li>alkalmazáshasználati adatok</li>
      <li>eszközinformációk</li>
    </ul>

    <h2>3. Az adatkezelés célja</h2>
    <ul>
      <li>az alkalmazás működésének biztosítása</li>
      <li>a felhasználói élmény javítása</li>
      <li>riportok és elemzések készítése</li>
      <li>szervezeti fejlesztés támogatása</li>
      <li>kommunikáció a felhasználókkal</li>
    </ul>

    <h2>4. Az adatkezelés jogalapja</h2>
    <ul>
      <li>a felhasználó hozzájárulása</li>
      <li>szerződés teljesítése</li>
      <li>jogos érdek</li>
      <li>jogi kötelezettség teljesítése, ha alkalmazandó</li>
    </ul>

    <h2>5. Adattárolás és adatbiztonság</h2>
    <p>
      Megfelelő technikai és szervezési intézkedéseket alkalmazunk a személyes adatok
      védelme érdekében, beleértve a titkosított adatátvitelt, a hozzáférés-kezelést
      és a biztonságos infrastruktúrát.
    </p>

    <h2>6. Adatok megőrzési ideje</h2>
    <p>
      A személyes adatokat csak addig őrizzük meg, ameddig az az adatkezelés céljához
      szükséges, illetve ameddig azt jogszabály előírja.
    </p>

    <h2>7. Adattovábbítás</h2>
    <p>
      A személyes adatokat nem értékesítjük harmadik fél részére. Egyes szolgáltatások
      teljesítéséhez igénybe vehetünk technikai partnereket, például tárhely- vagy
      infrastruktúra-szolgáltatókat.
    </p>

    <h2>8. Felhasználói jogok</h2>
    <p>
      A felhasználó jogosult tájékoztatást kérni a kezelt adatairól, kérheti azok
      helyesbítését, törlését, az adatkezelés korlátozását, továbbá élhet a
      tiltakozáshoz és adathordozhatósághoz való jogával.
    </p>

    <h2>9. Kapcsolat</h2>
    <p>
      Amennyiben kérdésed van az adatkezeléssel kapcsolatban, kérjük, vedd fel velünk a kapcsolatot az alábbi címen:
      <br />
      <a href="mailto:info@fempyapp.com">info@fempyapp.com</a>
    </p>

    <h2>10. Módosítások</h2>
    <p>
      Fenntartjuk a jogot a jelen tájékoztató módosítására. A frissített verziót ezen az oldalon tesszük közzé.
    </p>

    <div class="footer">
      Utolsó frissítés: 2026-04-20
    </div>
  </div>
</body>
</html>
    `;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.send(html);
  }
}