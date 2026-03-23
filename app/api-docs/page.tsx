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
    POST: "bg-[#1d4ed8]/10 text-[#60a5fa] border-[#1d4ed8]/20",
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
        <Icon size={15} className="text-[#60a5fa] flex-shrink-0" />
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
              <td className="px-3 py-2"><code className="text-[#60a5fa] font-mono">{p.name}</code></td>
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
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "linear-gradient(135deg,#1d4ed8,#60a5fa)" }}>
              <ZapIcon size={13} className="text-white" />
            </div>
            <h1 className="text-xl font-bold text-white">Insta Studio – API Docs</h1>
          </div>
          <p className="text-sm text-white/40">
            Openclaw-Integration für den Canvas-Editor. Karussells per API erstellen, befüllen und als PNG exportieren.
          </p>
        </div>

        {/* Quick reference */}
        <div className="rounded-2xl border border-white/[0.07] p-4 space-y-1" style={{ background: "rgba(29, 78, 216,0.05)" }}>
          <p className="text-[11px] font-semibold text-[#60a5fa] mb-2">Quick Reference</p>
          <EndpointRow method="GET"  path="/api/openclaw/templates"                        desc="Alle verfügbaren Templates und gespeicherten Karussells auflisten" />
          <EndpointRow method="GET"  path="/api/openclaw/templates/:id"                   desc="Genaue Struktur eines Templates (Slides, Elemente, Positionen)" />
          <EndpointRow method="GET"  path="/api/openclaw/carousels"                       desc="Alle erstellten Karussells mit Download-URLs auflisten" />
          <EndpointRow method="POST" path="/api/openclaw/carousels"                       desc="Slides aus Template befüllen + direkt als ZIP erhalten (kein DB-Eintrag)" />
          <EndpointRow method="GET"  path="/api/openclaw/carousels/:id/slides/:i/image.png" desc="Einzelnen Slide als PNG herunterladen" />
          <EndpointRow method="GET"  path="/api/openclaw/carousels/:id/slides/zip" desc="Alle Slides als ZIP-Archiv herunterladen (empfohlen)" />
        </div>

        {/* Auth */}
        <Section id="auth" title="Authentifizierung" icon={LockIcon}>
          <p className="text-[13px] text-white/50 leading-relaxed">
            Alle Openclaw-Endpoints sind durch einen API-Key gesichert. Der Key wird entweder als{" "}
            <code className="text-[#60a5fa]">Authorization: Bearer</code> Header oder als{" "}
            <code className="text-[#60a5fa]">X-API-Key</code> Header mitgeschickt.
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
          <p className="text-[12px] text-white/35 font-medium">Builtin IDs: <code className="text-[#60a5fa]">progress</code> · <code className="text-[#60a5fa]">tip</code> · <code className="text-[#60a5fa]">luxury</code></p>
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
      "background": "dark black gradient",
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
        <Section id="create" title="Karussell generieren → ZIP" icon={ZapIcon}>
          <div className="flex items-center gap-2">
            <MethodBadge method="POST" />
            <code className="text-[13px] font-mono text-white/70">/api/openclaw/carousels</code>
          </div>
          <p className="text-[13px] text-white/50">
            Rendert alle Slides eines Templates mit den angegebenen Texten und gibt sie <strong className="text-white/70">direkt als ZIP</strong> zurück.
            Kein Datenbank-Eintrag wird erstellt. Layout, Positionen, Schriftarten und Schriftgrößen bleiben unverändert.
          </p>

          <div className="rounded-xl border border-[#34d399]/20 bg-[#34d399]/5 px-4 py-3 space-y-2">
            <p className="text-[11px] font-semibold text-[#34d399]">✅ Neues, empfohlenes Format</p>
            <p className="text-[11px] text-white/50 leading-relaxed">
              <code className="text-[#60a5fa]">tag</code> und <code className="text-[#60a5fa]">body</code> sind <strong className="text-white/60">global</strong> – werden auf alle Slides angewendet.{" "}
              <code className="text-[#60a5fa]">slides[]</code> gibt <code className="text-[#60a5fa]">header</code> und <code className="text-[#60a5fa]">subtitle</code> pro Slide an.
              Das alte <code className="text-white/40">textOverrides</code>-Format bleibt für Rückwärtskompatibilität erhalten.
            </p>
          </div>

          <ParamTable params={[
            { name: "templateId",      type: "string",  req: true,  desc: "ID des Templates: 'progress', 'tip', 'luxury' oder gespeicherte Karussell-ID" },
            { name: "title",           type: "string",  req: false, desc: "ZIP-Dateiname (max 200 Zeichen). Default: 'carousel'" },
            { name: "grainIntensity",  type: "number",  req: false, desc: "Grain-Textur 0–100 (überschreibt Template-Standard)" },
            { name: "tag",             type: "string",  req: false, desc: "Globaler Tag-Text – gilt für ALLE Slides. Max 500 Zeichen." },
            { name: "body",            type: "string",  req: false, desc: "Globaler Body-Text – gilt für ALLE Slides (z.B. @handle). Max 500 Zeichen." },
            { name: "slides",          type: "array",   req: false, desc: "Pro-Slide-Texte für header und subtitle. Index 0 = erster Slide." },
            { name: "└ [i].header",    type: "string",  req: false, desc: "Hauptüberschrift für Slide i. Unterstützt \\n für Zeilenumbrüche." },
            { name: "└ [i].subtitle",  type: "string",  req: false, desc: "Untertitel für Slide i. Unterstützt \\n für Zeilenumbrüche." },
            { name: "textOverrides",   type: "array",   req: false, desc: "Legacy-Format: { slideIndex, elementType, text }. Wird durch neues Format überschrieben." },
          ]} />

          <CodeBlock lang="json" code={`// Neues Format (empfohlen)
{
  "templateId": "abc123",
  "title": "Update KW 9",
  "tag": "LAUNCH DAY",
  "body": "@denniskral_",
  "slides": [
    { "header": "Insta Studio ist live",   "subtitle": "Die App für mein Insta-Workflow." },
    { "header": "Was ich gebaut habe",       "subtitle": "Image Editor + Canvas + Openclaw\\nAlles in einer App." },
    { "header": "Was als nächstes kommt",    "subtitle": "KI-Training auf eigenen Prompts." }
  ]
}`} />

          <CodeBlock lang="bash" code={`# Request → gibt direkt ZIP-Binary zurück
curl -X POST ${BASE_URL}/api/openclaw/carousels \\
  -H "Authorization: Bearer YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -o slides.zip \\
  -d '{
    "templateId": "abc123",
    "title": "Update-KW-9",
    "tag": "LAUNCH DAY",
    "body": "@denniskral_",
    "slides": [
      { "header": "Insta Studio ist live", "subtitle": "3 Wochen Entwicklung.\\nHeute deployed." },
      { "header": "Feature #1: Image Editor" }
    ]
  }'`} />

          <div className="space-y-2">
            <p className="text-[11px] font-semibold text-white/40">Response Headers:</p>
            <CodeBlock lang="http" code={`Content-Type: application/zip
Content-Disposition: attachment; filename="update-kw-9.zip"
X-Slide-Count: 3`} />
          </div>

          <div className="rounded-xl border border-[#60a5fa]/20 bg-[#1d4ed8]/5 px-4 py-3 space-y-1">
            <p className="text-[11px] font-semibold text-[#60a5fa]">Zeilenumbrüche im Text</p>
            <p className="text-[11px] text-white/40">
              Nutze <code className="text-white/60">\n</code> (JSON: <code className="text-white/60">&quot;\\n&quot;</code>) für Zeilenumbrüche.
              Auch <code className="text-white/40">/n</code> wird akzeptiert.
            </p>
          </div>
        </Section>

        {/* Download ZIP – empfohlen */}
        <Section id="zip" title="Alle Slides als ZIP herunterladen (empfohlen)" icon={ImageIcon}>
          <div className="flex items-center gap-2">
            <MethodBadge method="GET" />
            <code className="text-[13px] font-mono text-white/70">/api/openclaw/carousels/:id/slides/zip</code>
          </div>
          <p className="text-[13px] text-white/50">
            Rendert <strong className="text-white/70">alle Slides</strong> eines gespeicherten Karussells und gibt sie als ZIP-Archiv zurück.
            Enthält <code className="text-[#60a5fa]">slide-1.png</code>, <code className="text-[#60a5fa]">slide-2.png</code>, etc.
            API-Key ist erforderlich.
          </p>
          <div className="rounded-xl border border-[#34d399]/20 bg-[#34d399]/5 px-4 py-3">
            <p className="text-[11px] text-[#34d399]/80">
              ✅ Dies ist der empfohlene Weg um alle Slides zu bekommen – ein Request, ein ZIP.
            </p>
          </div>
          <CodeBlock lang="bash" code={`curl -H "Authorization: Bearer YOUR_KEY" \\
  -o carousel.zip \\
  "${BASE_URL}/api/openclaw/carousels/YOUR_CAROUSEL_ID/slides/zip"`} />
          <ParamTable params={[
            { name: ":id", type: "string", req: true, desc: "Karussell-ID aus der POST-Response (carouselId)" },
          ]} />
        </Section>

        {/* Download einzelner PNG */}
        <Section id="png" title="Einzelnen Slide als PNG herunterladen" icon={ImageIcon}>
          <div className="flex items-center gap-2">
            <MethodBadge method="GET" />
            <code className="text-[13px] font-mono text-white/70">/api/openclaw/carousels/:id/slides/:index/image.png</code>
          </div>
          <p className="text-[13px] text-white/50">
            Rendert einen einzelnen Slide als PNG-Datei (1080×1350px für 4:5, 1080×1080px für 1:1, 1080×1920px für 9:16).
            Für Einzelabrufe oder Vorschauen. Für den vollständigen Download lieber den ZIP-Endpoint nutzen.
          </p>
          <CodeBlock lang="bash" code={`# Slide 1 herunterladen (Index 0)
curl -o slide-1.png \\
  "${BASE_URL}/api/openclaw/carousels/YOUR_CAROUSEL_ID/slides/0/image.png"`} />
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
            Gibt alle gespeicherten Karussell-Templates zurück (die du im Canvas-Editor erstellt hast). Nutze die IDs als <code className="text-[#60a5fa]">templateId</code> im POST.
          </p>
          <CodeBlock lang="bash" code={`curl -H "Authorization: Bearer YOUR_KEY" \\
  ${BASE_URL}/api/openclaw/carousels`} />
          <CodeBlock lang="json" code={`{
  "templates": [
    {
      "id": "abc123",
      "title": "Mein Template",
      "slideCount": 5,
      "updatedAt": "2026-03-23T20:00:00.000Z"
    }
  ],
  "note": "Use any id as templateId in POST /api/openclaw/carousels to generate images."
}`} />
        </Section>

        {/* Complete Workflow */}
        <Section id="workflow" title="Typischer Workflow für Openclaw" icon={CodeIcon}>
          <p className="text-[13px] text-white/50">
            Empfohlene Reihenfolge für den Openclaw-Agenten:
          </p>
          <ol className="space-y-3">
            {[
              { n: "1", title: "Verfügbare Templates laden", code: `GET /api/openclaw/templates` },
              { n: "2", title: "Template-Struktur abfragen (Elemente, locked-Status, Slide-Anzahl)", code: `GET /api/openclaw/templates/:id` },
              { n: "3", title: "Slides generieren → direkt als ZIP (1 Request, kein DB-Eintrag)", code: `POST /api/openclaw/carousels\n{ templateId, tag, body, slides:[{header,subtitle},...] }` },
            ].map((step) => (
              <li key={step.n} className="flex gap-3">
                <span className="w-6 h-6 rounded-full bg-[#1d4ed8]/20 border border-[#1d4ed8]/30 flex items-center justify-center text-[11px] text-[#60a5fa] font-bold flex-shrink-0 mt-0.5">
                  {step.n}
                </span>
                <div className="flex-1">
                  <p className="text-[12px] font-medium text-white/70 mb-1">{step.title}</p>
                  <code className="text-[11px] text-white/40 font-mono whitespace-pre">{step.code}</code>
                </div>
              </li>
            ))}
          </ol>

          <CodeBlock lang="bash" code={`# Vollständig in 1 Request: Template befüllen + ZIP erhalten

curl -X POST ${BASE_URL}/api/openclaw/carousels \\
  -H "Authorization: Bearer YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -o carousel.zip \\
  -d '{
    "templateId": "YOUR_TEMPLATE_ID",
    "title": "KW-9-Update",
    "tag": "BUILD IN PUBLIC",
    "body": "@denniskral_",
    "slides": [
      {
        "header": "Insta Studio ist live",
        "subtitle": "3 Wochen Entwicklung.\\nHeute deployed."
      },
      {
        "header": "Was ich gebaut habe",
        "subtitle": "Image Editor · Canvas · Openclaw-API"
      },
      {
        "header": "Was als nächstes kommt",
        "subtitle": "KI-Training auf eigenen Prompts."
      }
    ]
  }'

# → carousel.zip enthält slide-1.png, slide-2.png, slide-3.png (1080px, kein Upload nötig)`} />
        </Section>

        {/* Locked Elements */}
        <Section id="locked" title="Fixierte Elemente (locked)" icon={LockIcon}>
          <p className="text-[13px] text-white/50 leading-relaxed">
            Elemente können im Canvas-Editor als <strong className="text-white/70">fixiert</strong> markiert werden (z.B. Fußzeile mit @handle).
            Fixierte Elemente erscheinen in der Template-Struktur mit <code className="text-[#60a5fa]">&quot;locked&quot;: true</code>
            und werden von <code className="text-[#60a5fa]">textOverrides</code> <strong className="text-white/70">nicht verändert</strong> – ihr Text bleibt immer wie im Template definiert.
          </p>
          <CodeBlock lang="json" code={`// GET /api/openclaw/templates/progress – Response (Ausschnitt)
{
  "slides": [{
    "elements": [
      {
        "type": "body",
        "defaultText": "@denniskral_",
        "locked": true,
        "note": "LOCKED – this element is anchored and cannot be changed via textOverrides."
      },
      {
        "type": "header",
        "defaultText": "Was ich diese Woche gebaut habe",
        "locked": false,
        "note": "Override with textOverrides: { slideIndex: 0, elementType: \\"header\\", text: \\"...\\" }"
      }
    ]
  }]
}`} /></Section>

        {/* Element Types */}
        <Section id="element-types" title="Textelement-Typen" icon={LayoutIcon}>
          <p className="text-[13px] text-white/50">
            Jedes Template besteht aus maximal 4 Textelement-Typen pro Slide.
          </p>
          <div className="grid grid-cols-1 gap-2">
            {[
              { type: "tag",      scope: "global",    scopeColor: "#34d399", desc: "Kleines Label ganz oben (z.B. 'BUILD IN PUBLIC'). Gilt für alle Slides – einmal setzen, überall gleich.", example: "LAUNCH DAY" },
              { type: "header",   scope: "pro slide",  scopeColor: "#60a5fa", desc: "Hauptüberschrift. Größte Schrift, fett. Kernbotschaft in 3–8 Wörtern. Jeder Slide hat seinen eigenen header.", example: "Insta Studio ist live" },
              { type: "subtitle", scope: "pro slide",  scopeColor: "#60a5fa", desc: "Erklärung oder Metrik unter dem Header. Jeder Slide hat seinen eigenen subtitle. Unterstützt \\n.", example: "3 Wochen Entwicklung\nheute deployed." },
              { type: "body",     scope: "global",    scopeColor: "#34d399", desc: "Kleiner Text ganz unten, meist der @handle. Gilt für alle Slides – einmal setzen, überall gleich.", example: "@denniskral_" },
            ].map((el) => (
              <div key={el.type} className="flex items-start gap-3 px-3 py-2.5 rounded-xl border border-white/[0.06]" style={{ background: "rgba(255,255,255,0.02)" }}>
                <code className="text-[11px] font-mono text-[#60a5fa] w-16 flex-shrink-0 mt-0.5">{el.type}</code>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ background: `${el.scopeColor}15`, color: el.scopeColor }}>
                      {el.scope}
                    </span>
                  </div>
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
          <CodeBlock lang="json" code={`// Fehler-Response Format (JSON)
{ "error": "Beschreibung des Fehlers" }

// POST /api/openclaw/carousels → Erfolg = application/zip (Binär, kein JSON!)
// Response-Header: Content-Type: application/zip
//                  X-Slide-Count: 3
//                  Content-Disposition: attachment; filename="titel.zip"`} />
        </Section>

        <div className="text-center py-4">
          <p className="text-[11px] text-white/20">Insta Studio · Openclaw API v1 · {BASE_URL}</p>
        </div>
      </div>
    </div>
  );
}
