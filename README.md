# TreenityStudio App

Deutschsprachige Web-App zur Organisation von Musik-, Recording- und Podcastprojekten im TreenityStudio.

**Ablauf:** Projekt anlegen → Session vorbereiten → Ergebnis dokumentieren → Audio-Versionen besprechen → nächste Schritte festhalten.

> **Stand: MVP / Einzelbenutzer-Prototyp.** Daten liegen nur im Browser des jeweiligen Geräts. Es gibt keine Anmeldung und keine Synchronisation.

## Starten

Voraussetzung: Node.js 20 oder neuer.

```bash
npm install
npm run dev        # Entwicklungsserver → http://localhost:5173
```

Weitere Befehle:

```bash
npm test           # Tests der Geschäftslogik und Import/Export
npm run build      # Produktions-Build nach dist/
npm run preview    # Build lokal ansehen
```

**Auf dem Smartphone testen:** `npm run dev` zeigt auch eine Netzwerk-Adresse an (z. B. `http://192.168.x.x:5173`). Diese im selben WLAN öffnen.
Achtung: Das Handy hat dann **seinen eigenen, getrennten Datenstand**.

Der Build in `dist/` ist statisch. Er funktioniert auf jedem einfachen Webhosting ohne Server-Konfiguration, weil die App Hash-Routing (`#/projekte`) verwendet.

## Hauptansichten

| Ansicht | Inhalt |
|---|---|
| **Übersicht** | Fokusprojekte (max. 3), nächste Sessions, offene nächste Schritte, Sessions, die noch abgeschlossen werden müssen |
| **Projekte** | Laufend / Ideen / Archiv, Filter nach Typ, Status und Beteiligten; Detailseite mit Aufgaben, Sessions, Audio und Links |
| **Sessions** | Planen (Ziel, Checkliste, Setup) und Abschließen (Ergebnis, Entscheidungen, Aufnahme-Links, nächste Schritte) |
| **Audio** | Verlinkte Versionen mit Player bzw. externem Link und Feedback mit Zeitbezug (mm:ss) |
| **Daten & Personen** | Beteiligte, Backup-Export/-Import, Beispieldaten |

## Wo werden Daten gespeichert?

- Im **localStorage des Browsers** unter dem Schlüssel `treenitystudio:data`.
- Jede Änderung wird sofort gespeichert und übersteht einen Reload.
- Das Format ist versioniert (`schemaVersion`). Spätere Modelländerungen werden über `migrate()` in `src/persistence/schema.ts` umgestellt.
- Ist der gespeicherte Stand unlesbar, überschreibt die App ihn **nicht**. Sie legt eine Kopie unter `treenitystudio:data:unlesbar` ab und bietet „Backup importieren“ oder „Neu beginnen“ an.
- Bei Änderungen in einem zweiten Tab wird der Stand automatisch übernommen.

## Export und Import

Unter **Daten & Personen**:

- **Export:** „Backup herunterladen“ erzeugt `treenitystudio-backup-JJJJ-MM-TT_HH-MM.json` mit allen Daten.
- **Import:** Die Datei wird zuerst vollständig geprüft. Geprüft werden JSON-Format, App-Kennung, Formatversion, alle Felder und die Verknüpfungen. Ungültige Dateien werden mit Begründung abgelehnt, und es wird nichts übernommen.
- Danach zeigt die App, wie viele Einträge in der Datei bzw. aktuell vorhanden sind, und du wählst ausdrücklich:
  - **Ergänzen:** Neue Einträge kommen dazu. Vorhandene bleiben unverändert, gleiche werden übersprungen, und Personen mit gleichem Namen werden zusammengeführt.
  - **Ersetzen:** Alle aktuellen Daten werden ersetzt. Dafür gibt es eine Bestätigung und optional vorher automatisch ein Backup des aktuellen Stands.
- Beide Varianten lassen sich direkt danach mit „Rückgängig“ zurücknehmen.

## Fachliche Regeln

- **Nächste Handlung = erste offene Aufgabe des Projekts.** Es gibt nur eine Aufgabenliste pro Projekt. Nächste Schritte aus einer Session sind normale Projektaufgaben mit Verweis auf die Session. „Als Nächstes“ setzt eine Aufgabe an die erste Stelle.
- **Höchstens 3 Fokusprojekte.** Archivierte Projekte können nicht angeheftet werden.
- **Pro Projekt höchstens eine Version als „aktueller Arbeitsstand“.** Eine neue Markierung löst die alte.
- **Archivieren** behält alle verknüpften Daten. Das Projekt lässt sich mit dem vorherigen Status wiederherstellen.
- **Löschen** (immer mit Bestätigung und „Rückgängig“):
  - Projekt → löscht Sessions, Aufgaben, Audio-Versionen inkl. Feedback, Links und Zuordnungen mit.
  - Session → zugehörige Aufgaben bleiben im Projekt, nur ohne Session-Bezug.
  - Audio-Version → zugehöriges Feedback wird mitgelöscht.
  - Person → wird aus Projekten und Sessions entfernt. Ihr Feedback bleibt als „Gelöschte Person“ erhalten.
- Ein Integritätscheck (`src/domain/integrity.ts`) verhindert verwaiste Datensätze beim Import.

## Audio-Links

- Direkte Links auf Audiodateien (`.mp3`, `.wav`, `.m4a`, `.aac`, `.ogg`, `.opus`, `.flac`, `.webm`) bekommen einen Player.
- Andere Links, z. B. Google-Drive-Freigaben, werden als externe Quelle geöffnet.
- Kann eine Datei nicht abgespielt werden, erscheint eine verständliche Meldung und der externe Link.
- Feedback-Zeitmarken springen im Player an die Stelle. „Aktuelle Player-Position übernehmen“ füllt die Zeit automatisch aus.

## Lokale Projektordner

Pfade (z. B. `~/Musik/Treenity/Projekt`) können als Link der Art „Projektordner (lokal)“ gespeichert und **kopiert** werden. Öffnen kann der Browser lokale Ordner aus Sicherheitsgründen nicht, und die App tut auch nicht so, als ob.

## Einschränkungen

- **Kein gemeinsamer Speicher:** Jeder Browser und jedes Gerät hat eigene Daten. Austausch nur über Export/Import.
- **Keine Anmeldung, keine Zugriffsrechte.** Personen sind reine Zuordnungsdatensätze.
- Browserdaten können durch Löschen der Website-Daten oder im privaten Modus verloren gehen. Deshalb regelmäßig ein Backup exportieren.
- Keine Synchronisation mit Notion oder Drive. Externe Inhalte werden nur verlinkt.
- Kein Hosting oder Verarbeiten von Audio-/DAW-Dateien.

**Für die gemeinsame Nutzung mit Christian und Alex** braucht es als nächste Ausbaustufe: echte Anmeldung, eine gemeinsame Datenbank (z. B. Supabase) und serverseitige Zugriffsrechte. Die Trennung von Geschäftslogik (`src/domain`) und Persistenz (`src/persistence`) ist darauf vorbereitet.

## Projektstruktur

```
src/
  domain/        Fachmodell, Geschäftslogik (reine Funktionen), Validierung, Abfragen, Beispieldaten
  persistence/   Datenformat (Zod-Schema, Versionierung), localStorage, Export/Import/Zusammenführen
  state/         App-Zustand (React Context), Speichern, Rückgängig
  ui/            Layout, Komponenten, Ansichten
    brand/Logo.tsx   Wortmarke – hier später das Treenity-Logo einsetzen
```

Stack: React, TypeScript, Vite, Tailwind CSS, React Router, Zod, Vitest.

## Beispieldaten

Unter „Daten & Personen“ oder auf der leeren Startseite lassen sich Beispieldaten laden. Sie sind mit „Beispiel“ gekennzeichnet, ihre Termine liegen relativ zum heutigen Datum, und es sind keine echten Projektstände. Ein Klick entfernt sie wieder vollständig.
