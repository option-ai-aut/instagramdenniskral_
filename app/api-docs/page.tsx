"use client";

import { useState } from "react";
import { CheckIcon, CopyIcon, ChevronDownIcon, ChevronRightIcon, ZapIcon, LockIcon, ImageIcon, LayoutIcon, CodeIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const BASE_URL = "https://instagramdenniskral.vercel.app";

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-md border border-white/10 text-white/30 hover:text-white/70 hover:border-white/20 transition-all"
    >
      {copied ? <CheckIcon size={10} className="text-[#34d399]" /> : <CopyIcon size={10} />}
      {copied ? "Kopiert" : "Kopieren"}
    </button>
  );
}

function CodeBlock({ code, lang = "json" }: { code: string; lang?: string }) {
  return (
    <div className="relative rounded-xl border border-white/[0.06] overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/[0.06]" style={{ background: "rgba(255,255,255,0.03)" }}>
        <span className="text-[10px] text-white/25 font-mono">{lang}</span>
        <CopyButton text={code} />
      </div>
      <pre className="px-4 py-3 text-[12px] font-mono text-white/70 overflow-x-auto leading-relaxed" style={{ background: "rgba(0,0,0,0.3)" }}>
        <code>{code}</code>
      </pre>
    </div>
  );
}

function MethodBadge({ method }: { method: string }) {
  const colors: Record<string, string> = {
    GET: "bg-[#34d399]/10 text-[#34d399] border-[#34d399]/20",
    POST: "bg-[#7c6af7]/10 text-[#a78bfa] border-[#7c6af7]/20",
    PATCH: "bg-[#fbbf24]/10 text-[#fbbf24] border-[#fbbf24]/20",
    DELETE: "bg-[#f87171]/10 text-[#f87171] border-[#f87171]/20",
  };
  return (
    <span className={cn("text-[11px] font-mono font-bold px-2 py-0.5 rounded border", colors[method] ?? "bg-white/5 text-white/50 border-white/10")}>
      {method}
    </span>
  );
}

function Section({ id, title, icon: Icon, children }: { id: string; title: string; icon: React.ElementType; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <div id={id} className="rounded-2xl border border-white/[0.07] overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 px-5 py-4 hover:bg-white/[0.02] transition-colors"
        style={{ background: "rgba(255,255,255,0.025)" }}
      >
        <Icon size={15} className="text-[#a78bfa] flex-shrink-0" />
        <span className="text-sm font-semibold text-white flex-1 text-left">{title}</span>
        {open ? <ChevronDownIcon size={14} className="text-white/30" /> : <ChevronRightIcon size={14} className="text-white/30" />}
      </button>
      {open && <div className="px-5 pb-5 pt-3 space-y-5">{children}</div>}
    </div>
  );
}

function EndpointRow({ method, path, desc }: { method: string; path: string; desc: string }) {
  return (
    <div className="flex items-start gap-3 py-2 border-b border-white/[0.04] last:border-0">
      <MethodBadge method={method} />
      <div>
        <code className="text-[12px] font-mono text-white/80">{path}</code>
        <p className="text-[11px] text-white/35 mt-0.5">{desc}</p>
      </div>
    </div>
  );
}

function ParamTable({ params }: { params: Array<{ name: string; type: string; req: boolean; desc: string }> }) {
  return (
    <div className="rounded-xl border border-white/[0.06] overflow-hidden">
      <table className="w-full text-[11px]">
        <thead>
          <tr style={{ background: "rgba(255,255,255,0.03)" }}>
            <th className="text-left px-3 py-2 text-white/40 font-medium">Feld</th>
            <th className="text-left px-3 py-2 text-white/40 font-medium">Typ</th>
            <th className="text-left px-3 py-2 text-white/40 font-medium">Pflicht</th>
            <th className="text-left px-3 py-2 text-white/40 font-medium">Beschreibung</th>
          </tr>
        </thead>
        <tbody>
          {params.map((p) => (
            <tr key={p.name} className="border-t border-white/[0.04]">
              <td className="px-3 py-2"><code className="text-[#a78bfa] font-mono">{p.name}</code></td>
              <td className="px-3 py-2 text-white/40 font-mono">{p.type}</td>
              <td className="px-3 py-2">
                <span className={cn("px-1.5 py-0.5 rounded text-[10px] font-medium", p.req ? "bg-[#f87171]/10 text-[#f87171]" : "bg-white/5 text-white/30")}>
                  {p.req ? "ja" : "nein"}
                </span>
              </td>
              <td className="px-3 py-2 text-white/50">{p.desc}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function ApiDocsPage() {
  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-3xl mx-auto px-5 py-8 space-y-6">

        {/* Header */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "linear-gradient(135deg,#7c6af7,#a78bfa)" }}>
              <ZapIcon size={13} className="text-white" />
            </div>
            <h1 className="text-xl font-bold text-white">Insta Builder – API Docs</h1>
          </div>
          <p className="text-sm text-white/40">
            Openclaw-Integration für den Canvas-Editor. Karussells per API erstellen, befüllen und als PNG exportieren.
          </p>
        </div>

        {/* Quick reference */}
        <div className="rounded-2xl border border-white/[0.07] p-4 space-y-1" style={{ background: "rgba(124,106,247,0.05)" }}>
          <p className="text-[11px] font-semibold text-[#a78bfa] mb-2">Quick Reference</p>
          <EndpointRow method="GET"  path="/api/openclaw/templates"                        desc="Alle verfügbaren Templates und gespeicherten Karussells auflisten" />
          <EndpointRow method="GET"  path="/api/openclaw/templates/:id"                   desc="Genaue Struktur eines Templates (Slides, Elemente, Positionen)" />
          <EndpointRow method="GET"  path="/api/openclaw/carousels"                       desc="Alle erstellten Karussells mit Download-URLs auflisten" />
          <EndpointRow method="POST" path="/api/openclaw/carousels"                       desc="Neues Karussell aus Template erstellen + Texte befüllen" />
          <EndpointRow method="GET"  path="/api/openclaw/carousels/:id/slides/:i/image.png" desc="Slide als PNG-Datei herunterladen (direkt, kein Browser)" />
        </div>

        {/* Auth */}
        <Section id="auth" title="Authentifizierung" icon={LockIcon}>
          <p className="text-[13px] text-white/50 leading-relaxed">
            Alle Openclaw-Endpoints sind durch einen API-Key gesichert. Der Key wird entweder als{" "}
            <code className="text-[#a78bfa]">Authorization: Bearer</code> Header oder als{" "}
            <code className="text-[#a78bfa]">X-API-Key</code> Header mitgeschickt.
            <br /><br />
            Den aktuellen Key findest du in den Vercel-Umgebungsvariablen: <code className="text-white/60">OPENCLAW_API_KEY</code>
          </p>
          <CodeBlock lang="http" code={`GET ${BASE_URL}/api/openclaw/templates
Authorization: Bearer YOUR_API_KEY

# Alternativ:
X-API-Key: YOUR_API_KEY`} />
          <div className="rounded-xl border border-[#f87171]/20 bg-[#f87171]/5 px-4 py-3">
            <p className="text-[11px] text-[#f87171]/80">
              ⚠️ Den API-Key niemals in der App oder in Frontend-Code exponieren. Nur serverseitig oder in Openclaw verwenden.
            </p>
          </div>
        </Section>

        {/* Templates */}
        <Section id="templates" title="Templates auflisten" icon={LayoutIcon}>
          <div className="flex items-center gap-2">
            <MethodBadge method="GET" />
            <code className="text-[13px] font-mono text-white/70">/api/openclaw/templates</code>
          </div>
          <p className="text-[13px] text-white/50">
            Gibt alle 3 eingebauten Basis-Templates sowie alle gespeicherten Karussells zurück.
            Jedes Template zeigt welche Text-Elemente (tag, header, subtitle, body) pro Slide vorhanden sind.
          </p>
          <CodeBlock lang="bash" code={`curl -H "Authorization: Bearer YOUR_KEY" \\
  ${BASE_URL}/api/openclaw/templates`} />
          <CodeBlock lang="json" code={`{
  "builtinTemplates": [
    {
      "id": "progress",
      "name": "Progress Update",
      "description": "Build-in-Public style post",
      "slideCount": 1,
      "type": "builtin",
      "exampleTextElements": [
        { "type": "tag",      "placeholder": "BUILD IN PUBLIC" },
        { "type": "header",   "placeholder": "Was ich diese Woche gebaut habe" },
        { "type": "subtitle", "placeholder": "Von 0 auf 1.000 Nutzer in 30 Tagen" },
        { "type": "body",     "placeholder": "@denniskral_" }
      ]
    },
    { "id": "tip",     "name": "Hilfreicher Tipp", ... },
    { "id": "luxury",  "name": "Luxury Lifestyle", ... }
  ],
  "savedTemplates": [
    {
      "id": "abc123",
      "name": "Mein gespeichertes Karussell",
      "slideCount": 3,
      "type": "saved",
      "slides": [{ "slideIndex": 0, "elements": [...] }]
    }
  ]
}`} />
        </Section>

        {/* Template Detail */}
        <Section id="template-detail" title="Template-Struktur abfragen" icon={LayoutIcon}>
          <div className="flex items-center gap-2">
            <MethodBadge method="GET" />
            <code className="text-[13px] font-mono text-white/70">/api/openclaw/templates/:id</code>
          </div>
          <p className="text-[13px] text-white/50">
            Gibt die genaue Struktur eines Templates zurück: jeder Slide, jedes Textelement mit Typ, Position und Default-Text.
            Ideal um vor dem POST zu wissen welche Felder befüllt werden sollen.
          </p>
          <p className="text-[12px] text-white/35 font-medium">Builtin IDs: <code className="text-[#a78bfa]">progress</code> · <code className="text-[#a78bfa]">tip</code> · <code className="text-[#a78bfa]">luxury</code></p>
          <CodeBlock lang="bash" code={`# Builtin Template abfragen
curl -H "Authorization: Bearer YOUR_KEY" \\
  ${BASE_URL}/api/openclaw/templates/progress

# Gespeichertes Karussell abfragen
curl -H "Authorization: Bearer YOUR_KEY" \\
  ${BASE_URL}/api/openclaw/templates/abc123`} />
          <CodeBlock lang="json" code={`{
  "id": "progress",
  "name": "Progress Update",
  "type": "builtin",
  "slideCount": 1,
  "slides": [
    {
      "slideIndex": 0,
      "aspectRatio": "4:5",
      "background": "dark purple gradient",
      "elements": [
        {
          "type": "tag",
          "defaultText": "BUILD IN PUBLIC",
          "fontSize": 11,
          "position_y_percent": 15,
          "align": "center",
          "note": "Short label, caps recommended. E.g. 'WEEK 3 UPDATE'"
        },
        {
          "type": "header",
          "defaultText": "Was ich diese Woche gebaut habe",
          "fontSize": 32,
          "position_y_percent": 40,
          "align": "center",
          "note": "Main headline. Keep it concise, 5-10 words."
        },
        { "type": "subtitle", "position_y_percent": 62, ... },
        { "type": "body",     "position_y_percent": 88, "note": "Usually @denniskral_" }
      ]
    }
  ],
  "usage": {
    "hint": "Pass this templateId to POST /api/openclaw/carousels",
    "exampleRequest": {
      "templateId": "progress",
      "title": "Mein Post Titel",
      "textOverrides": [
        { "slideIndex": 0, "elementType": "tag",      "text": "WEEK 3 UPDATE" },
        { "slideIndex": 0, "elementType": "header",   "text": "Dein Header" },
        { "slideIndex": 0, "elementType": "subtitle", "text": "Dein Subtitle" }
      ]
    }
  }
}`} />
        </Section>

        {/* Create Carousel */}
        <Section id="create" title="Karussell erstellen" icon={ZapIcon}>
          <div className="flex items-center gap-2">
            <MethodBadge method="POST" />
            <code className="text-[13px] font-mono text-white/70">/api/openclaw/carousels</code>
          </div>
          <p className="text-[13px] text-white/50">
            Erstellt ein neues Karussell basierend auf einem Template (builtin oder gespeichert) und ersetzt die Texte mit den angegebenen Werten.
            Layout, Positionen, Farben und Schriftgrößen bleiben unverändert – nur der Text-Inhalt wird überschrieben.
          </p>

          <ParamTable params={[
            { name: "templateId",    type: "string",  req: true,  desc: "ID des Templates: 'progress', 'tip', 'luxury' oder gespeicherte Karussell-ID" },
            { name: "title",         type: "string",  req: false, desc: "Titel des neuen Karussells (max 200 Zeichen). Default: 'Openclaw Carousel'" },
            { name: "textOverrides", type: "array",   req: false, desc: "Liste von Text-Ersetzungen. Ohne textOverrides wird der Default-Text verwendet." },
            { name: "└ slideIndex",  type: "number",  req: true,  desc: "0-basierter Slide-Index (0 = erster Slide)" },
            { name: "└ elementType", type: "string",  req: true,  desc: "Typ des Elements: 'header' | 'subtitle' | 'body' | 'tag'" },
            { name: "└ text",        type: "string",  req: true,  desc: "Neuer Textinhalt. Unterstützt \\n für Zeilenumbrüche. Max 500 Zeichen." },
          ]} />

          <CodeBlock lang="bash" code={`curl -X POST ${BASE_URL}/api/openclaw/carousels \\
  -H "Authorization: Bearer YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "templateId": "progress",
    "title": "Update KW 9 – Launch Day",
    "textOverrides": [
      { "slideIndex": 0, "elementType": "tag",      "text": "LAUNCH DAY" },
      { "slideIndex": 0, "elementType": "header",   "text": "Insta Builder ist live" },
      { "slideIndex": 0, "elementType": "subtitle", "text": "Nach 3 Wochen Entwicklung\\nheute endlich deployed." }
    ]
  }'`} />

          <CodeBlock lang="json" code={`{
  "carouselId": "abc123def456",
  "title": "Update KW 9 – Launch Day",
  "slideCount": 1,
  "slideImageUrls": [
    "${BASE_URL}/api/openclaw/carousels/abc123/slides/0/image.png"
  ],
  "viewUrl": "${BASE_URL}/canvas?load=abc123",
  "slides": [
    {
      "slideIndex": 0,
      "downloadUrl": "${BASE_URL}/api/openclaw/carousels/abc123/slides/0/image.png",
      "elements": [
        { "type": "tag",      "text": "LAUNCH DAY" },
        { "type": "header",   "text": "Insta Builder ist live" },
        { "type": "subtitle", "text": "Nach 3 Wochen Entwicklung\\nheute endlich deployed." },
        { "type": "body",     "text": "@denniskral_" }
      ]
    }
  ]
}`} />

          <div className="rounded-xl border border-[#a78bfa]/20 bg-[#7c6af7]/5 px-4 py-3 space-y-1">
            <p className="text-[11px] font-semibold text-[#a78bfa]">💡 Tipp: Zeilenumbrüche</p>
            <p className="text-[11px] text-white/40">
              Nutze <code className="text-white/60">\n</code> im JSON-String für Zeilenumbrüche im Text.
              Jede neue Zeile wird im Slide und in der PNG-Datei korrekt gerendert.
            </p>
          </div>
        </Section>

        {/* Download PNG */}
        <Section id="png" title="Slides als PNG herunterladen" icon={ImageIcon}>
          <div className="flex items-center gap-2">
            <MethodBadge method="GET" />
            <code className="text-[13px] font-mono text-white/70">/api/openclaw/carousels/:id/slides/:index/image.png</code>
          </div>
          <p className="text-[13px] text-white/50">
            Rendert einen einzelnen Slide als PNG-Datei (1080×1350px für 4:5, 1080×1080px für 1:1, 1080×1920px für 9:16).
            Kein Browser notwendig – Rendering passiert serverseitig via Satori/next/og.
            <br /><br />
            Die URLs kommen direkt aus der POST-Response (<code className="text-[#a78bfa]">slideImageUrls[]</code>).
            Kein eigener API-Key nötig für den Download – die Karussell-ID ist nicht erratbar.
          </p>
          <CodeBlock lang="bash" code={`# Slide 1 herunterladen (Index 0)
curl -o slide-1.png \\
  "${BASE_URL}/api/openclaw/carousels/YOUR_CAROUSEL_ID/slides/0/image.png"

# Alle Slides eines Karussells herunterladen (Bash-Beispiel)
CAROUSEL_ID="abc123def456"
for i in 0 1 2; do
  curl -o "slide-$((i+1)).png" \\
    "${BASE_URL}/api/openclaw/carousels/$CAROUSEL_ID/slides/$i/image.png"
done`} />

          <ParamTable params={[
            { name: ":id",    type: "string", req: true, desc: "Karussell-ID aus der POST-Response" },
            { name: ":index", type: "number", req: true, desc: "0-basierter Slide-Index. 0 = erster Slide, 1 = zweiter Slide, ..." },
          ]} />
        </Section>

        {/* List Carousels */}
        <Section id="list" title="Karussells auflisten" icon={LayoutIcon}>
          <div className="flex items-center gap-2">
            <MethodBadge method="GET" />
            <code className="text-[13px] font-mono text-white/70">/api/openclaw/carousels</code>
          </div>
          <p className="text-[13px] text-white/50">
            Gibt alle bisher erstellten Karussells zurück, inkl. PNG-URLs für jeden Slide.
          </p>
          <CodeBlock lang="bash" code={`curl -H "Authorization: Bearer YOUR_KEY" \\
  ${BASE_URL}/api/openclaw/carousels`} />
          <CodeBlock lang="json" code={`{
  "carousels": [
    {
      "id": "abc123",
      "title": "Update KW 9 – Launch Day",
      "slideCount": 1,
      "updatedAt": "2026-02-28T20:00:00.000Z",
      "slideImageUrls": [
        "${BASE_URL}/api/openclaw/carousels/abc123/slides/0/image.png"
      ],
      "viewUrl": "${BASE_URL}/canvas?load=abc123"
    }
  ]
}`} />
        </Section>

        {/* Complete Workflow */}
        <Section id="workflow" title="Typischer Workflow für Openclaw" icon={CodeIcon}>
          <p className="text-[13px] text-white/50">
            Empfohlene Reihenfolge für den Openclaw-Agenten:
          </p>
          <ol className="space-y-3">
            {[
              { n: "1", title: "Templates laden", code: `GET /api/openclaw/templates` },
              { n: "2", title: "Template-Struktur verstehen", code: `GET /api/openclaw/templates/progress` },
              { n: "3", title: "Karussell erstellen & Texte befüllen", code: `POST /api/openclaw/carousels\n{ templateId, title, textOverrides }` },
              { n: "4", title: "PNG-Bilder herunterladen", code: `GET /api/openclaw/carousels/:id/slides/0/image.png\nGET /api/openclaw/carousels/:id/slides/1/image.png` },
              { n: "5", title: "(Optional) Im Editor öffnen", code: `Öffne viewUrl: /canvas?load=:id` },
            ].map((step) => (
              <li key={step.n} className="flex gap-3">
                <span className="w-6 h-6 rounded-full bg-[#7c6af7]/20 border border-[#7c6af7]/30 flex items-center justify-center text-[11px] text-[#a78bfa] font-bold flex-shrink-0 mt-0.5">
                  {step.n}
                </span>
                <div className="flex-1">
                  <p className="text-[12px] font-medium text-white/70 mb-1">{step.title}</p>
                  <code className="text-[11px] text-white/40 font-mono whitespace-pre">{step.code}</code>
                </div>
              </li>
            ))}
          </ol>
        </Section>

        {/* Element Types */}
        <Section id="element-types" title="Textelement-Typen" icon={LayoutIcon}>
          <p className="text-[13px] text-white/50">
            Jedes Template besteht aus maximal 4 Textelement-Typen pro Slide.
            Beim POST müssen Typ und slideIndex exakt matchen.
          </p>
          <div className="grid grid-cols-1 gap-2">
            {[
              { type: "tag",      desc: "Kleines Label ganz oben (z.B. 'BUILD IN PUBLIC', 'PRO TIPP'). Meist in Farbe.", example: "LAUNCH DAY" },
              { type: "header",   desc: "Hauptüberschrift. Größte Schrift, fett. Kernbotschaft in 3-8 Wörtern.", example: "Insta Builder ist live" },
              { type: "subtitle", desc: "Erklärung oder Metrik unter dem Header. Unterstützt \\n für Absätze.", example: "3 Wochen Entwicklung\nheute deployed." },
              { type: "body",     desc: "Kleiner Text ganz unten, meist der @handle. Selten ändern.", example: "@denniskral_" },
            ].map((el) => (
              <div key={el.type} className="flex items-start gap-3 px-3 py-2.5 rounded-xl border border-white/[0.06]" style={{ background: "rgba(255,255,255,0.02)" }}>
                <code className="text-[11px] font-mono text-[#a78bfa] w-16 flex-shrink-0 mt-0.5">{el.type}</code>
                <div>
                  <p className="text-[11px] text-white/50">{el.desc}</p>
                  <p className="text-[10px] text-white/25 mt-0.5">Beispiel: <span className="text-white/40 font-mono">&quot;{el.example}&quot;</span></p>
                </div>
              </div>
            ))}
          </div>
        </Section>

        {/* Errors */}
        <Section id="errors" title="Fehlercodes" icon={ZapIcon}>
          <div className="rounded-xl border border-white/[0.06] overflow-hidden">
            <table className="w-full text-[11px]">
              <thead>
                <tr style={{ background: "rgba(255,255,255,0.03)" }}>
                  <th className="text-left px-3 py-2 text-white/40 font-medium">Code</th>
                  <th className="text-left px-3 py-2 text-white/40 font-medium">Bedeutung</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["200 / 201", "Erfolg"],
                  ["400", "Ungültiger Request – fehlende oder fehlerhafte Parameter"],
                  ["401", "Falscher oder fehlender API-Key"],
                  ["404", "Template/Karussell nicht gefunden"],
                  ["500", "Serverfehler – error-Feld enthält Details"],
                  ["503", "OPENCLAW_API_KEY nicht in Vercel konfiguriert"],
                ].map(([code, desc]) => (
                  <tr key={code} className="border-t border-white/[0.04]">
                    <td className="px-3 py-2"><code className="font-mono text-[#fbbf24]">{code}</code></td>
                    <td className="px-3 py-2 text-white/45">{desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <CodeBlock lang="json" code={`// Fehler-Response Format
{ "error": "Beschreibung des Fehlers" }

// Erfolg (POST)
{ "carouselId": "...", "slideImageUrls": [...], "viewUrl": "..." }`} />
        </Section>

        <div className="text-center py-4">
          <p className="text-[11px] text-white/20">Insta Builder · Openclaw API v1 · {BASE_URL}</p>
        </div>
      </div>
    </div>
  );
}
