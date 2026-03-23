# Insta Studio – API Dokumentation

> Stand: März 2026  
> Basis-URL: `https://instagramdenniskral.vercel.app`

---

## Inhaltsverzeichnis

1. [Authentifizierung](#authentifizierung)
2. [Gemini Modelle](#gemini-modelle)
3. [Öffentliche Endpunkte](#öffentliche-endpunkte)
4. [App-Endpunkte (Passwort-geschützt)](#app-endpunkte)
5. [Openclaw API (API-Key)](#openclaw-api)
6. [Umgebungsvariablen](#umgebungsvariablen)
7. [Fehler-Codes](#fehler-codes)

---

## Authentifizierung

### Zwei unabhängige Systeme

| System | Für | Mechanismus |
|--------|-----|-------------|
| **App-Passwort** | Browser / alle Dashboard-Routen | `app_auth`-Cookie (wird beim Login gesetzt) |
| **Openclaw API-Key** | Externe Automatisierungen (Openclaw-Agent) | `Authorization: Bearer <key>` oder `X-API-Key: <key>` Header |

### App Login

```http
POST /api/auth/login
Content-Type: application/json

{ "password": "dein-passwort" }
```

Setzt einen `app_auth`-Cookie (httpOnly, SameSite=Lax, 30 Tage). Alle Dashboard-Routen prüfen diesen Cookie via `middleware.ts`.

```http
POST /api/auth/logout
```

Löscht den `app_auth`-Cookie.

### Openclaw API-Key

Der Key wird als Umgebungsvariable `OPENCLAW_API_KEY` auf Vercel gesetzt. Jeder Request an `/api/openclaw/*` muss einen der folgenden Header senden:

```http
Authorization: Bearer oc_...
# oder
X-API-Key: oc_...
```

Falls `OPENCLAW_API_KEY` nicht konfiguriert ist → `503 Service Unavailable`.

---

## Gemini Modelle

| Konstante | Modell | Verwendung |
|-----------|--------|-----------|
| `IMAGE_MODEL` | `gemini-3-pro-image-preview` | Bildbearbeitung in allen `/api/generate*` Routen |
| `TEXT_MODEL` | `gemini-3.1-pro-preview` | Stil-Analyse & Prompt-Writing in `/api/generate/smart` (Step 1) |

### Gemini Image Editing – API-Format

```typescript
// Korrekte Verwendung via @google/genai SDK
import { GoogleGenAI, Modality } from "@google/genai";

const response = await ai.models.generateContent({
  model: "gemini-3-pro-image-preview",
  contents: [{
    role: "user",
    parts: [
      { inlineData: { mimeType: "image/jpeg", data: "<base64>" } },
      { text: "Bearbeitungs-Anweisung" }
    ]
  }],
  config: {
    responseModalities: [Modality.IMAGE, Modality.TEXT], // PFLICHT – ohne das kein Bild in der Antwort
    imageConfig: { imageSize: "1K" }  // "1K" | "2K" | "4K"
  }
});
// Antwort: candidates[0].content.parts[].inlineData.data (base64 PNG)
```

> **Wichtig:** `responseModalities: [Modality.IMAGE, Modality.TEXT]` ist **zwingend erforderlich** – ohne diesen Parameter gibt das Modell kein Bild zurück (→ 500 Fehler).  
> Das alte Modell `gemini-2.0-flash-preview-image-generation` wurde am 31.10.2025 abgeschaltet.

### Gemini Text / Thinking – API-Format

```typescript
const response = await ai.models.generateContent({
  model: "gemini-3.1-pro-preview",
  contents: [{ role: "user", parts: [{ text: "..." }] }],
  config: {
    systemInstruction: "Du bist ein ...",
    thinkingConfig: { thinkingLevel: ThinkingLevel.LOW }  // LOW | MEDIUM | HIGH
  }
});
```

---

## Öffentliche Endpunkte

*(kein Cookie und kein API-Key nötig)*

### `POST /api/auth/login`

| Feld | Typ | Pflicht |
|------|-----|---------|
| `password` | string | ✅ |

**Response 200:**
```json
{ "success": true }
```

**Response 401:**
```json
{ "error": "Falsches Passwort" }
```

---

### `POST /api/auth/logout`

Kein Body. Löscht `app_auth`-Cookie.

**Response 200:** `{ "success": true }`

---

## App-Endpunkte

*(Alle Routen erfordern den `app_auth`-Cookie)*

---

### Bild-Generierung

#### `POST /api/generate`

Bearbeitet ein einzelnes Bild mit `gemini-3-pro-image-preview`.

| Feld | Typ | Pflicht | Limit |
|------|-----|---------|-------|
| `imageItemId` | string | ✅ | – |
| `imageBase64` | string | ✅ | max 10 MB (Base64) |
| `mimeType` | string | ❌ | default: `image/jpeg` |
| `prompt` | string | ✅ | max 2000 Zeichen |

**Response 200:**
```json
{
  "success": true,
  "resultBase64": "<base64-PNG>",
  "mimeType": "image/png",
  "resultUrl": "https://...supabase.co/storage/..."
}
```

> `resultUrl` ist die persistente Supabase-URL des generierten Bildes (wird nach Seitenreload als Fallback genutzt).

---

#### `POST /api/generate/smart`

2-stufige KI-Generierung für alle hochgeladenen Bilder:
1. **Step 1** – `gemini-3.1-pro-preview` analysiert jedes Bild + gespeicherte Prompts → erzeugt bild-spezifische Bearbeitungsanweisung
2. **Step 2** – `gemini-3-pro-image-preview` bearbeitet das Bild

Beide Schritte laufen **parallel** für alle Bilder (`Promise.all`).

| Feld | Typ | Pflicht | Limit |
|------|-----|---------|-------|
| `images` | Array | ✅ | max 20 Bilder |
| `images[].imageBase64` | string | ✅ | max 10 MB (Base64) |
| `images[].mimeType` | string | ✅ | – |
| `images[].imageItemId` | string | ✅ | – |
| `savedPrompts` | string[] | ✅ | mind. 1 |

**Response 200:**
```json
{
  "results": [
    {
      "imageItemId": "temp-abc123",
      "resultBase64": "<base64>",
      "mimeType": "image/png",
      "derivedPrompt": "Replace the car with a matte black Porsche 911 GT3..."
    },
    {
      "imageItemId": "temp-xyz789",
      "error": "Fehlermeldung wenn dieses Bild fehlschlug"
    }
  ]
}
```

---

### Instagram Import

#### `POST /api/instagram/import`

Importiert Bilder von einem öffentlichen Instagram-Post.

| Feld | Typ | Pflicht |
|------|-----|---------|
| `url` | string | ✅ |
| `sessionId` | string | ❌ (überschreibt `INSTAGRAM_SESSION_ID` env) |

**Ablauf:**
1. Extrahiert Shortcode aus URL
2. Versucht **Instagram Mobile API** (`i.instagram.com/api/v1/media/{id}/info/`)
3. Fallback: Instagram Web API (`?__a=1&__d=dis`)
4. Lädt bis zu 20 Bilder herunter, dedupliziert CDN-Varianten

**Response 200:**
```json
{
  "images": [
    {
      "base64": "<base64>",
      "mimeType": "image/jpeg",
      "index": 0,
      "sourceUrl": "https://cdn.instagram.com/..."
    }
  ],
  "isCarousel": true,
  "postUrl": "https://www.instagram.com/p/ABC123/",
  "shortcode": "ABC123"
}
```

**Response 503 (kein Session-Cookie):**
```json
{
  "error": "Instagram-Session nicht konfiguriert",
  "setupRequired": true
}
```

> **Session-Cookie:** Den `sessionid`-Cookie aus Instagram-Cookies (Safari → Entwicklerwerkzeuge → Cookies → `sessionid`). Kann einmalig über das Zahnrad-Symbol im Image Editor hinterlegt werden (wird in `localStorage` gespeichert).

---

### Canvas Export

#### `POST /api/canvas/export`

Rendert alle Slides serverseitig (Satori/next-og) zu PNGs und gibt ein ZIP zurück.

| Feld | Typ | Pflicht | Default |
|------|-----|---------|---------|
| `slides` | Slide[] | ✅ | – |
| `title` | string | ❌ | `"carousel"` |
| `grainIntensity` | number 0–100 | ❌ | `0` |
| `grainSize` | number 0–100 | ❌ | `40` |
| `grainDensity` | number 0–100 | ❌ | `50` |
| `grainSharpness` | number 0–100 | ❌ | `50` |

**Response 200:** `application/zip` (Binär)  
Dateinamen: `<title>-slide-1.png`, `<title>-slide-2.png`, …

---

### Carousels (gespeicherte Vorlagen)

#### `GET /api/carousel`

Listet alle gespeicherten Karussells.

**Response 200:** `{ "carousels": Carousel[] }`

---

#### `POST /api/carousel`

Erstellt ein neues Karussell.

| Feld | Typ | Pflicht |
|------|-----|---------|
| `slidesJson` | any | ✅ |
| `title` | string | ❌ |
| `thumbUrl` | string | ❌ |

**Response 200:** `{ "carousel": Carousel }`

---

#### `GET /api/carousel/[id]`

Gibt ein einzelnes Karussell zurück. **Response 200:** `{ "carousel": Carousel }` | **404**

---

#### `PATCH /api/carousel/[id]`

Aktualisiert Titel, Slides oder Thumbnail.

| Feld | Typ | Limit |
|------|-----|-------|
| `title` | string | max 200 Zeichen |
| `slidesJson` | any | – |
| `thumbUrl` | any | – |

**Response 200:** `{ "success": true }`

---

#### `DELETE /api/carousel/[id]`

**Response 200:** `{ "success": true }` | **404**

---

### Prompts

#### `GET /api/prompts`

Listet alle gespeicherten Prompts (sortiert nach Erstellungsdatum, neueste zuerst).

**Response 200:** `{ "prompts": SavedPrompt[] }`

---

#### `POST /api/prompts`

| Feld | Typ | Limit |
|------|-----|-------|
| `text` | string | max 2000 Zeichen |

**Response 201:** `{ "prompt": SavedPrompt }`

---

#### `DELETE /api/prompts/[id]`

**Response 200:** `{ "success": true }` | **404**

---

### Sessions & Images

#### `GET /api/sessions`

Listet die letzten 10 Sessions mit allen zugehörigen Bildern.

**Response 200:** `{ "sessions": Session[] }`

---

#### `POST /api/sessions`

| Feld | Typ | Limit | Default |
|------|-----|-------|---------|
| `name` | string | max 200 Zeichen | `"Neue Session"` |

**Response 200:** `{ "session": Session }`

---

#### `POST /api/sessions/[id]/images`

Lädt ein Originalbild zu Supabase hoch und erstellt einen `ImageItem`-Eintrag.

| Feld | Typ | Pflicht | Limit |
|------|-----|---------|-------|
| `imageBase64` | string | ✅ | max 10 MB (Base64) |
| `mimeType` | string | ❌ | Whitelist: `image/jpeg`, `image/png`, `image/webp`, `image/gif` |

**Response 200:** `{ "item": ImageItem }`

---

#### `DELETE /api/image/[id]`

Löscht ein Bild (prüft Eigentümerschaft via Session → User).

**Response 200:** `{ "success": true }` | **404**

---

#### `GET /api/history`

Paginierte History aller Sessions und Karussells (unabhängige Pagination).

| Query-Param | Typ | Default | Max |
|-------------|-----|---------|-----|
| `sessionPage` | number | `1` | – |
| `carouselPage` | number | `1` | – |
| `limit` | number | `20` | `50` |

**Response 200:**
```json
{
  "sessions": [...],
  "carousels": [...],
  "sessionTotal": 42,
  "carouselTotal": 15,
  "pagination": { "sessionPage": 1, "carouselPage": 1, "limit": 20 }
}
```

---

## Openclaw API

*(Alle Routen erfordern `Authorization: Bearer <OPENCLAW_API_KEY>`)*

Die Openclaw-Routen sind **öffentlich zugänglich** (kein App-Passwort), aber durch den API-Key gesichert. Sie ermöglichen es dem Openclaw-Agenten, Karussell-Vorlagen zu laden, Text einzufügen und fertige Bilder als ZIP zu erhalten – **ohne** neue Vorlagen in der Datenbank zu erstellen.

---

### `GET /api/openclaw/templates`

Listet alle verfügbaren Templates (Builtin + gespeicherte Karussells) mit vollständiger Element-Struktur.

**Response 200:**
```json
{
  "builtinTemplates": [
    {
      "id": "progress",
      "name": "Build in Public – Progress",
      "slideCount": 1,
      "slides": [
        {
          "slideIndex": 0,
          "elements": [
            {
              "type": "tag",
              "defaultText": "BUILD IN PUBLIC",
              "locked": false,
              "fontSize": 11,
              "fontFamily": "Montserrat",
              "color": "#60a5fa"
            }
          ]
        }
      ]
    }
  ],
  "savedTemplates": [...],
  "usage": { "hint": "Use templateId in POST /api/openclaw/carousels" }
}
```

---

### `GET /api/openclaw/templates/[id]`

Detaillierte Struktur eines einzelnen Templates.

**Response 200:**
```json
{
  "id": "progress",
  "name": "Build in Public – Progress",
  "type": "builtin",
  "slideCount": 1,
  "slides": [
    {
      "slideIndex": 0,
      "elements": [
        {
          "type": "header",
          "defaultText": "Was ich diese Woche gebaut habe",
          "locked": false,
          "fontSize": 32,
          "fontWeight": "extrabold",
          "fontFamily": "Playfair Display",
          "color": "#ffffff",
          "align": "center",
          "x": 50,
          "y": 40
        }
      ]
    }
  ],
  "usage": {
    "exampleRequest": {
      "templateId": "progress",
      "title": "Mein Post",
      "grainIntensity": 20,
      "textOverrides": [
        { "slideIndex": 0, "elementType": "header", "text": "Mein Text" }
      ]
    }
  }
}
```

---

### `GET /api/openclaw/carousels`

Listet alle gespeicherten Karussells (ohne builtin).

**Response 200:**
```json
{
  "templates": [
    {
      "id": "abc123",
      "title": "Meine Vorlage",
      "slideCount": 5,
      "updatedAt": "2026-03-23T20:00:00.000Z"
    }
  ],
  "note": "Use any id as templateId in POST /api/openclaw/carousels to generate images."
}
```

> Die `id` aus `templates[]` wird direkt als `templateId` im POST-Body verwendet.

---

### `POST /api/openclaw/carousels` ⭐ Haupt-Endpunkt

Generiert alle Slides als ZIP – **kein DB-Eintrag** wird erstellt. Gibt direkt `application/zip` zurück.

#### Neues Format (empfohlen)

`tag` und `body` sind **global** – werden auf **alle Slides** angewendet.  
`slides[]` gibt `header` und `subtitle` **pro Slide** an.

```json
{
  "templateId": "abc123",
  "title": "Update-KW-9",
  "grainIntensity": 20,
  "tag": "BUILD IN PUBLIC",
  "body": "@denniskral_",
  "slides": [
    { "header": "Slide 1 Titel", "subtitle": "Erklärung\nZweite Zeile" },
    { "header": "Slide 2 Titel", "subtitle": "Andere Erklärung" },
    { "header": "Slide 3 Titel" }
  ]
}
```

| Feld | Typ | Pflicht | Beschreibung |
|------|-----|---------|-------------|
| `templateId` | string | ✅ | Builtin-ID (`progress`/`tip`/`luxury`) oder gespeicherte Karussell-ID |
| `title` | string | ❌ | ZIP-Dateiname (default: `"carousel"`) |
| `grainIntensity` | number 0–100 | ❌ | Überschreibt Template-Grain-Standard |
| `tag` | string | ❌ | **Global** – gilt für alle Slides. Max 500 Zeichen. |
| `body` | string | ❌ | **Global** – gilt für alle Slides (z.B. `@handle`). Max 500 Zeichen. |
| `slides` | Array | ❌ | Pro-Slide-Texte: `{ header?, subtitle? }` |
| `slides[i].header` | string | ❌ | Hauptüberschrift für Slide i. Unterstützt `\n`. |
| `slides[i].subtitle` | string | ❌ | Untertitel für Slide i. Unterstützt `\n`. |
| `textOverrides` | Array | ❌ | **Legacy** – `{ slideIndex, elementType, text }`. Wird durch neues Format überschrieben. |

**Zeilenumbrüche:** `\n` (JSON: `"\\n"`) oder echter Zeilenumbruch – beides korrekt. Auch `/n` akzeptiert.

**Response 200:** `application/zip` (direkt binär – kein JSON)  
Headers: `X-Slide-Count: 3`, `Content-Disposition: attachment; filename="update-kw-9.zip"`

ZIP-Inhalt: `update-kw-9-slide-1.png`, `update-kw-9-slide-2.png`, …

**Gesperrte Elemente:** Elemente mit `locked: true` können nicht überschrieben werden und werden stillschweigend ignoriert.

---

### `GET /api/openclaw/carousels/[id]/slides/zip`

Rendert ein gespeichertes Karussell ohne Text-Overrides als ZIP.

| Query-Param | Typ | Default |
|-------------|-----|---------|
| `grain` | number 0–100 | `0` |

**Response 200:** `application/zip`

---

### `GET /api/openclaw/carousels/[id]/slides/[index]/image.png`

Rendert einen einzelnen Slide als PNG (0-basierter Index).

**Response 200:** `image/png`  
**Response 404:** Slide nicht gefunden

---

## Umgebungsvariablen

| Variable | Pflicht | Beschreibung |
|----------|---------|-------------|
| `APP_PASSWORD` | ✅ | App-Login-Passwort (Klartext) |
| `APP_PASSWORD_HASH` | ❌ | Falls gesetzt: wird statt Klartext-Passwort im Cookie gespeichert |
| `GOOGLE_AI_API_KEY` | ✅ | Google AI Studio API Key ([aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)) |
| `OPENCLAW_API_KEY` | ✅ (für Openclaw) | API-Key für externe Openclaw-Zugriffe |
| `INSTAGRAM_SESSION_ID` | ❌ | Server-seitiger Fallback für Instagram-Import (`sessionid`-Cookie) |
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | Supabase-Projekt-URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | Supabase Anon-Key (öffentlich) |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Supabase Service-Role-Key (**geheim – nur Vercel**) |
| `DATABASE_URL` | ❌ | Prisma Connection String (nur für Migrationen) |

> ⚠️ `SUPABASE_SERVICE_ROLE_KEY` niemals im Frontend verwenden oder committen – dieser Key umgeht Row-Level-Security.

---

## Fehler-Codes

| Code | Bedeutung |
|------|-----------|
| `400` | Ungültige Eingabe (fehlende Pflichtfelder, zu langer Text, etc.) |
| `401` | Nicht eingeloggt (App-Passwort fehlt oder falsch) |
| `403` | Zugriff verweigert (falsches Ownership) |
| `404` | Ressource nicht gefunden |
| `500` | Interner Fehler (Gemini-API-Fehler, Render-Fehler, etc.) |
| `503` | Service nicht konfiguriert (`OPENCLAW_API_KEY` oder `INSTAGRAM_SESSION_ID` fehlt) |

---

## Datenmodell (Übersicht)

```
User
  └── Session (1:n)
        └── ImageItem (1:n)   { originalUrl, resultUrl, prompt, status }

User
  └── Carousel (1:n)          { title, slidesJson, thumbUrl }

SavedPrompt                    { text, userId, createdAt }
```

`userId` ist immer `"denniskral"` (Single-User-App).

---

## Slide / TextElement Typen

```typescript
type TextElement = {
  id: string;
  type: "header" | "subtitle" | "body" | "tag";
  text: string;
  fontSize: number;           // in px (design-width 380px)
  fontWeight: "normal" | "medium" | "semibold" | "bold" | "extrabold";
  fontFamily: string;         // Google Font Name
  color: string;              // CSS color string
  align: "left" | "center" | "right";
  x: number;                  // 0–100 (Prozent der Canvas-Breite)
  y: number;                  // 0–100 (Prozent der Canvas-Höhe)
  verticalAnchor?: "top" | "center" | "bottom";
  locked?: boolean;           // true = nicht via API änderbar
};

type SlideBackground = {
  type: "solid" | "gradient" | "image";
  color?: string;
  gradient?: string;          // CSS gradient string
  customGradient?: CustomGradient;
  imageUrl?: string;
};

type Slide = {
  id: string;
  background: SlideBackground;
  aspectRatio: string;        // z.B. "4:5"
  elements: TextElement[];
};
```

Beim Satori-Export (1080px) werden alle `fontSize`-Werte mit Faktor `1080/380 ≈ 2.84` skaliert.
